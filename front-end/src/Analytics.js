/** This file is code for the Analytics page for the UPSStore App */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LineChart, Line,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer,
} from 'recharts';

const URGENCY_COLORS = {
  'Reorder Now': '#c53030',
  'Due Soon':    '#b7791f',
  'OK':          '#2f855a',
};

const URGENCY_ORDER = ['Reorder Now', 'Due Soon', 'OK'];

/** Tests to see if an item needs to be reordered and changes the display to reflect urgency. */
function urgencyFromItem(item) {
  if (item.should_reorder) return 'Reorder Now';
  if (item.days_until_reorder !== null && item.days_until_reorder < 7) return 'Due Soon';
  return 'OK';
}

/** Prevent too large of a value */
function formatDays(value) {
  if (value === null || value === undefined) return '—';
  if (value > 999) return '999+ d';
  return `${Math.round(value)} d`;
}

/** Generates bars reflecting days left for a given inventory item */
function DaysBar({ days, cls }) {
  if (days === null || days === undefined) {
    return <span style={{ color: '#8a9bb0' }}>—</span>;
  }
  const pct = Math.max(2, Math.min((days / 60) * 100, 100));
  const color = cls === 'critical' ? 'var(--danger)' : cls === 'low' ? 'var(--warn)' : 'var(--safe)';
  return (
    <div className="daysBarWrap">
      <div className="daysBarTrack">
        <div className="daysBarFill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="daysBarLabel">{Math.round(days)}d</span>
    </div>
  );
}

/** Keeps usage rates in a x.xx/day format */
function formatRate(value) {
  if (!value) return '—';
  return `${value.toFixed(2)}/day`;
}

/** Function for displaying inventory trends */
function HistoryChart({ sku, days }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setLoading(true);

    fetch(`/api/analytics/${sku}/history?days=${days}`)
      .then((r) => r.json())
      .then((data) => {
        if (!mounted) return;
        setHistory(
          data.map((entry) => ({
            ...entry,
            label: new Date(entry.timestamp).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
            }),
          }))
        );
      })
      .catch(() => {})
      .finally(() => {
        if (mounted) setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [sku, days]);

  if (loading) return <p className="emptyState">Loading history…</p>;
  if (history.length === 0) return <p className="emptyState">No log entries in this period.</p>;

  return (
    <ResponsiveContainer width="100%" height={160}>
      <LineChart data={history} margin={{ top: 4, right: 16, bottom: 0, left: 0 }}>
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis tick={{ fontSize: 11 }} width={42} />
        <Tooltip
          formatter={(val) => [val, 'Qty after']}
          contentStyle={{ fontSize: '0.82rem', borderRadius: '8px' }}
        />
        <Line
          type="monotone"
          dataKey="quantity_after"
          stroke="#0e7a6a"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

/** Primary function: Displays the page. Shows a pie chart of number of SKUs and how many are approaching needing an order, and how many need an order. 
The items with the highest use rate are displayed.
Every item has its own row that can be expanded to show greater information and display a line chart showing changes in inventory over the time span the user inputs. */
function Analytics() {
  const [analytics, setAnalytics] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [params, setParams] = useState({ days: 30, lead_time: 5, safety_stock: 3 });
  const [draftParams, setDraftParams] = useState({ days: 30, lead_time: 5, safety_stock: 3 });
  const [sortConfig, setSortConfig] = useState({ key: 'urgency', direction: 'asc' });
  const [expandedSku, setExpandedSku] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const loadAnalytics = useCallback(() => {
    setLoading(true);
    setError('');
    const { days, lead_time, safety_stock } = params;

    fetch(`/api/analytics?days=${days}&lead_time=${lead_time}&safety_stock=${safety_stock}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Request failed with ${r.status}`);
        return r.json();
      })
      .then((data) => setAnalytics(data))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [params]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const enriched = useMemo(
    () => analytics.map((item) => ({ ...item, urgency: urgencyFromItem(item) })),
    [analytics]
  );

  const summary = useMemo(
    () => ({
      reorderNow: enriched.filter((i) => i.urgency === 'Reorder Now').length,
      dueSoon: enriched.filter((i) => i.urgency === 'Due Soon').length,
      noData: enriched.filter((i) => !i.daily_usage_rate).length,
      total: enriched.length,
    }),
    [enriched]
  );

  const pieData = useMemo(() => [
    { name: 'Reorder Now', value: summary.reorderNow, color: URGENCY_COLORS['Reorder Now'] },
    { name: 'Due Soon',    value: summary.dueSoon,    color: URGENCY_COLORS['Due Soon'] },
    { name: 'OK',          value: summary.total - summary.reorderNow - summary.dueSoon, color: URGENCY_COLORS['OK'] },
  ].filter((d) => d.value > 0), [summary]);

  const topUsage = useMemo(() =>
    [...enriched]
      .filter((i) => i.daily_usage_rate > 0)
      .sort((a, b) => b.daily_usage_rate - a.daily_usage_rate)
      .slice(0, 8)
      .map((i) => ({
        name: i.description.length > 22 ? i.description.slice(0, 20) + '…' : i.description,
        rate: parseFloat(i.daily_usage_rate.toFixed(2)),
      })),
  [enriched]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return enriched;
    return enriched.filter(
      (item) =>
        item.sku.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term)
    );
  }, [enriched, searchTerm]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const { key, direction } = sortConfig;
      let av = key === 'urgency' ? URGENCY_ORDER.indexOf(a.urgency) : a[key];
      let bv = key === 'urgency' ? URGENCY_ORDER.indexOf(b.urgency) : b[key];
      if (av === null || av === undefined) av = Infinity;
      if (bv === null || bv === undefined) bv = Infinity;
      if (av === bv) return 0;
      const cmp = av < bv ? -1 : 1;
      return direction === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortConfig]);

  function toggleSort(key) {
    setSortConfig((c) =>
      c.key === key
        ? { key, direction: c.direction === 'asc' ? 'desc' : 'asc' }
        : { key, direction: 'asc' }
    );
  }

  function applyParams() {
    setParams({ ...draftParams });
    setExpandedSku(null);
  }

  function toggleExpand(sku) {
    setExpandedSku((current) => (current === sku ? null : sku));
  }

  function renderSortLabel(label, key) {
    if (sortConfig.key !== key) return `${label} ↕`;
    return `${label} ${sortConfig.direction === 'asc' ? '↑' : '↓'}`;
  }

  function urgencyClass(urgency) {
    if (urgency === 'Reorder Now') return 'critical';
    if (urgency === 'Due Soon') return 'low';
    return 'healthy';
  }

  return (
    <div>
      <div className="analyticsCards">
        <div className={`analyticsCard ${summary.reorderNow > 0 ? 'cardDanger' : 'cardSafe'}`}>
          <p className="cardValue">{summary.reorderNow}</p>
          <p className="cardLabel">Reorder Now</p>
        </div>
        <div className={`analyticsCard ${summary.dueSoon > 0 ? 'cardWarn' : 'cardSafe'}`}>
          <p className="cardValue">{summary.dueSoon}</p>
          <p className="cardLabel">Due Soon (&lt; 7 days)</p>
        </div>
        <div className="analyticsCard cardNeutral">
          <p className="cardValue">{summary.noData}</p>
          <p className="cardLabel">No Usage Data</p>
        </div>
        <div className="analyticsCard cardNeutral">
          <p className="cardValue">{summary.total}</p>
          <p className="cardLabel">Total SKUs Tracked</p>
        </div>
      </div>

      <section className="analyticsParams">
        <div className="paramGroup">
          <label className="paramLabel">
            Look-back
            <input
              type="number"
              min="1"
              max="365"
              className="paramInput"
              value={draftParams.days}
              onChange={(e) =>
                setDraftParams((d) => ({ ...d, days: Number(e.target.value) }))
              }
            />
            <span className="paramUnit">days</span>
          </label>
          <label className="paramLabel">
            Lead time
            <input
              type="number"
              min="1"
              max="90"
              className="paramInput"
              value={draftParams.lead_time}
              onChange={(e) =>
                setDraftParams((d) => ({ ...d, lead_time: Number(e.target.value) }))
              }
            />
            <span className="paramUnit">days</span>
          </label>
          <label className="paramLabel">
            Safety stock
            <input
              type="number"
              min="0"
              max="30"
              className="paramInput"
              value={draftParams.safety_stock}
              onChange={(e) =>
                setDraftParams((d) => ({ ...d, safety_stock: Number(e.target.value) }))
              }
            />
            <span className="paramUnit">days</span>
          </label>
          <button type="button" className="exportBtn" onClick={applyParams}>
            Apply
          </button>
        </div>
        <input
          type="search"
          className="analyticsSearch"
          placeholder="Search SKU or description…"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          aria-label="Search analytics"
        />
      </section>

      {error && <p className="emptyState" role="alert">{error}</p>}
      {loading && <p className="emptyState">Loading analytics…</p>}

      {!loading && enriched.length > 0 && console.log('chartsRow rendering', enriched.length)}
      {!loading && (
        <div className="chartsRow">
          <div className="chartCard">
            <p className="chartTitle">Urgency Breakdown</p>
            <div className="donutWrap">
              <div
                className="cssDonut"
                style={{
                  background: `conic-gradient(${pieData.map((d, i) => {
                    const start = pieData.slice(0, i).reduce((s, x) => s + (x.value / summary.total) * 360, 0);
                    const end = start + (d.value / summary.total) * 360;
                    return `${d.color} ${start}deg ${end}deg`;
                  }).join(', ')})`,
                }}
              >
                <div className="cssDonutHole">
                  <span className="donutTotal">{summary.total}</span>
                  <span className="donutLabel">SKUs</span>
                </div>
              </div>
            </div>
            <div className="donutLegend">
              {pieData.map((d) => (
                <div key={d.name} className="legendItem">
                  <span className="legendDot" style={{ background: d.color }} />
                  <span>{d.name}</span>
                  <span className="legendVal">{d.value}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="chartCard">
            <p className="chartTitle">Top Items by Daily Usage</p>
            {topUsage.length === 0
              ? <p className="emptyState">No usage data in this period.</p>
              : (
                <div className="cssBarChart">
                  {topUsage.map((item) => (
                    <div key={item.name} className="cssBarRow">
                      <span className="cssBarName">{item.name}</span>
                      <div className="cssBarTrack">
                        <div
                          className="cssBarFill"
                          style={{ width: `${(item.rate / topUsage[0].rate) * 100}%` }}
                        />
                      </div>
                      <span className="cssBarVal">{item.rate}/day</span>
                    </div>
                  ))}
                </div>
              )
            }
          </div>
        </div>
      )}

      {!loading && (
        <section className="tableCard">
          <table>
            <thead>
              <tr>
                <th>
                  <button type="button" className="sortButton" onClick={() => toggleSort('sku')}>
                    {renderSortLabel('SKU', 'sku')}
                  </button>
                </th>
                <th>
                  <button type="button" className="sortButton" onClick={() => toggleSort('description')}>
                    {renderSortLabel('Product', 'description')}
                  </button>
                </th>
                <th>
                  <button type="button" className="sortButton" onClick={() => toggleSort('current_quantity')}>
                    {renderSortLabel('On-hand', 'current_quantity')}
                  </button>
                </th>
                <th>
                  <button type="button" className="sortButton" onClick={() => toggleSort('daily_usage_rate')}>
                    {renderSortLabel('Daily Usage', 'daily_usage_rate')}
                  </button>
                </th>
                <th>
                  <button type="button" className="sortButton" onClick={() => toggleSort('days_until_empty')}>
                    {renderSortLabel('Days Left', 'days_until_empty')}
                  </button>
                </th>
                <th>
                  <button type="button" className="sortButton" onClick={() => toggleSort('reorder_point')}>
                    {renderSortLabel('Reorder At', 'reorder_point')}
                  </button>
                </th>
                <th>
                  <button type="button" className="sortButton" onClick={() => toggleSort('urgency')}>
                    {renderSortLabel('Status', 'urgency')}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((item) => (
                <React.Fragment key={item.sku}>
                  <tr
                    className={`analyticsRow${item.urgency !== 'OK' ? ' warningRow' : ''}`}
                    onClick={() => toggleExpand(item.sku)}
                    aria-expanded={expandedSku === item.sku}
                  >
                    <td>{item.sku}</td>
                    <td>{item.description}</td>
                    <td>{item.current_quantity}</td>
                    <td>{formatRate(item.daily_usage_rate)}</td>
                    <td><DaysBar days={item.days_until_empty} cls={urgencyClass(item.urgency)} /></td>
                    <td>{item.reorder_point ?? '—'}</td>
                    <td>
                      <span className={`status ${urgencyClass(item.urgency)}`}>
                        {item.urgency}
                      </span>
                    </td>
                  </tr>

                  {expandedSku === item.sku && (
                    <tr className="detailRow">
                      <td colSpan={7}>
                        <div className="detailPanel">
                          <div className="detailStats">
                            <div className="detailStat">
                              <span className="statLabel">Lead Time</span>
                              <span className="statValue">{item.lead_time_days} d</span>
                            </div>
                            <div className="detailStat">
                              <span className="statLabel">Safety Stock</span>
                              <span className="statValue">{item.safety_stock_days} d</span>
                            </div>
                            <div className="detailStat">
                              <span className="statLabel">Days to Reorder</span>
                              <span className="statValue">{formatDays(item.days_until_reorder)}</span>
                            </div>
                            <div className="detailStat">
                              <span className="statLabel">Reorder Point</span>
                              <span className="statValue">{item.reorder_point ?? '—'} units</span>
                            </div>
                          </div>
                          <div className="detailChart">
                            <p className="chartTitle">
                              Inventory Level — Last {params.days} Days
                            </p>
                            <HistoryChart sku={item.sku} days={params.days} />
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>

          {sorted.length === 0 && (
            <p className="emptyState">No items match your search.</p>
          )}
        </section>
      )}
    </div>
  );
}

export default Analytics;
