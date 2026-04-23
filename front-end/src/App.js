/** This file is code for the main page for the Inventory page for the UPS Store app */
import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import Analytics from './Analytics';

const STATUS_ORDER = ['Critical', 'Low', 'Healthy'];

/** Sorts items into size categories from their descriptions */
function sizeFromDescription(description) {
  const normalized = description.toLowerCase();

  if (normalized.includes('24x24x24') || normalized.includes('20x20x12') || normalized.includes('18x18x18')) {
    return 'Large';
  }

  if (normalized.includes('12x12x12') || normalized.includes('10x10x10') || normalized.includes('08x08x08')) {
    return 'Small';
  }

  return 'N/A';
}

/** Returns status from critical to healthy based on quantity of inventory items */
function statusFromQuantity(quantity) {
  if (quantity <= 0) {
    return 'Critical';
  }

  if (quantity <= 10) {
    return 'Low';
  }

  return 'Healthy';
}

function compareValues(a, b, direction) {
  if (a === b) {
    return 0;
  }

  if (typeof a === 'number' && typeof b === 'number') {
    return direction === 'asc' ? a - b : b - a;
  }

  return direction === 'asc'
    ? String(a).localeCompare(String(b))
    : String(b).localeCompare(String(a));
}

/** Main function 
* Contains function for manual setting of inventory numbers 
* Prevents setting inventory counts to negative 
* Prevents attempting to set inventory count without an entry
* Attempts to set new inventory count, throw error in event of failure 
* Allows for sorting of inventory by ascending or descending for a given attribute 
* Allows for search for item by SKU or description 
* Allows to filter search by inventory status - critical, low, or healthy
* Allows filtering of search by item size large or small 
* Allows for sorting table by ascending or descending attributes, also provides labels for attributes 
* Display message if user's search results are empty */
function App() {
  const [view, setView] = useState('inventory');
  const [inventory, setInventory] = useState([]);
  const [lastScan, setLastScan] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [sizeFilter, setSizeFilter] = useState('All Sizes');
  const [sortConfig, setSortConfig] = useState({ key: 'description', direction: 'asc' });
  const [drafts, setDrafts] = useState({});
  const [savingSku, setSavingSku] = useState('');
  const [deletingSku, setDeletingSku] = useState('');
  const [blacklistingSku, setBlacklistingSku] = useState('');
  const [showOverride, setShowOverride] = useState(false);
  const [importingCsv, setImportingCsv] = useState(false);
  const [showBlacklist, setShowBlacklist] = useState(false);
  const [blacklist, setBlacklist] = useState([]);
  const [blacklistLoading, setBlacklistLoading] = useState(false);
  const [unblacklistingSku, setUnblacklistingSku] = useState('');
  const csvInputRef = React.useRef(null);

  useEffect(() => {
    let isMounted = true;

    async function loadInventory() {
      setLoading(true);
      setError('');

      try {
        const response = await fetch('/api/inventory');
        if (!response.ok) {
          throw new Error(`Inventory request failed with ${response.status}`);
        }

        const data = await response.json();
        if (isMounted) {
          setInventory(data);
        }
      } catch (requestError) {
        if (isMounted) {
          setError(requestError.message);
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    }

    loadInventory();

    return () => {
      isMounted = false;
    };
  }, []);
  
 // get last scan date 
  useEffect(() => {
	  let isMounted = true;
	  
	  async function loadLastScan() {
		  setLoading(true);
		  setError('');
		  
		  try { const response = await fetch('/api/lastscan');
		  
		  const scanData = await response.json();
		  if (isMounted) {
			  setLastScan(scanData);
		  }
	  } catch (requestError) {
		  if (isMounted) {
			  setError(requestError.message);
		  }
	  } finally {
		  if (isMounted) {
			  setLoading(false);
		  }
	  }
  }
  
  loadLastScan();
  return () => {
	  isMounted = false;
  };
}, []);
			  

  const statusOptions = ['All Statuses', ...STATUS_ORDER];

  const filteredInventory = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    const normalizedInventory = inventory.map((item) => {
      const status = statusFromQuantity(item.item_quantity);
      const size = sizeFromDescription(item.description);

      return {
        ...item,
        status,
        size,
      };
    });

    const visibleInventory = normalizedInventory.filter((item) => {
      const matchesSearch =
        term.length === 0 ||
        item.sku.toLowerCase().includes(term) ||
        item.description.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === 'All Statuses' || item.status === statusFilter;

      const matchesSize = sizeFilter === 'All Sizes' || item.size === sizeFilter;

      return matchesSearch && matchesStatus && matchesSize;
    });

    return [...visibleInventory].sort((left, right) => {
      if (sortConfig.key === 'status') {
        return compareValues(
          STATUS_ORDER.indexOf(left.status),
          STATUS_ORDER.indexOf(right.status),
          sortConfig.direction
        );
      }

      return compareValues(left[sortConfig.key], right[sortConfig.key], sortConfig.direction);
    });
  }, [inventory, searchTerm, sizeFilter, sortConfig, statusFilter]);


const visibleDate = lastScan.timestamp
  ? new Date(lastScan.timestamp).toLocaleString('en-US', {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    })
  : null;

  function toggleSort(key) {
    setSortConfig((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === 'asc' ? 'desc' : 'asc',
        };
      }

      return {
        key,
        direction: 'asc',
      };
    });
  }

  function updateDraft(sku, value) {
    setDrafts((current) => ({
      ...current,
      [sku]: value,
    }));
  }

  async function saveManualOverride(item) {
    const draftValue = drafts[item.sku];
    const nextQuantity = draftValue === undefined ? item.item_quantity : Number(draftValue);

    if (!Number.isInteger(nextQuantity) || nextQuantity < 0) {
      setError(`Manual override for ${item.sku} must be a non-negative integer.`);
      return;
    }

    setSavingSku(item.sku);
    setError('');

    try {
      const response = await fetch(`/api/inventory/${item.sku}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ item_quantity: nextQuantity }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Update failed with ${response.status}`);
      }

      const updatedItem = await response.json();
      setInventory((current) => current.map((entry) => (
        entry.sku === updatedItem.sku ? updatedItem : entry
      )));
      setDrafts((current) => ({
        ...current,
        [item.sku]: String(updatedItem.item_quantity),
      }));
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setSavingSku('');
    }
  }

  async function deleteInventoryItem(item) {
    if (!window.confirm(`Are you sure you want to delete this item from the table?`)) {
      return;
    }

    setDeletingSku(item.sku);
    setError('');

    try {
      const response = await fetch(`/api/inventory/${item.sku}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Delete failed with ${response.status}`);
      }

      setInventory((current) => current.filter((entry) => entry.sku !== item.sku));
      setDrafts((current) => {
        const next = { ...current };
        delete next[item.sku];
        return next;
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setDeletingSku('');
    }
  }

  async function blacklistItem(item) {
    if (!window.confirm(`Are you sure you want to blacklist SKU ${item.sku}? It will be removed from inventory and excluded from all future CSV imports.`)) {
      return;
    }

    setBlacklistingSku(item.sku);
    setError('');

    try {
      const response = await fetch(`/api/blacklist/${item.sku}`, { method: 'POST' });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Blacklist failed with ${response.status}`);
      }

      setInventory((current) => current.filter((entry) => entry.sku !== item.sku));
      setDrafts((current) => {
        const next = { ...current };
        delete next[item.sku];
        return next;
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setBlacklistingSku('');
    }
  }

  async function loadBlacklist() {
    setBlacklistLoading(true);
    try {
      const response = await fetch('/api/blacklist');
      if (!response.ok) throw new Error(`Failed to load blacklist: ${response.status}`);
      const data = await response.json();
      setBlacklist(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBlacklistLoading(false);
    }
  }

  async function unblacklistItem(sku) {
    if (!window.confirm(`Remove SKU ${sku} from the blacklist? It will be eligible for future CSV imports but will NOT be re-added to inventory automatically.`)) {
      return;
    }

    setUnblacklistingSku(sku);
    try {
      const response = await fetch(`/api/blacklist/${sku}`, { method: 'DELETE' });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Failed with ${response.status}`);
      }
      setBlacklist((current) => current.filter((entry) => entry.sku !== sku));
    } catch (err) {
      setError(err.message);
    } finally {
      setUnblacklistingSku('');
    }
  }

  async function handleCsvImport(event) {
    const file = event.target.files[0];
    if (!file) return;

    setImportingCsv(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await fetch('/api/csv/upload', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || `Import failed with ${response.status}`);
      }

      // Refresh inventory after successful import
      const invResponse = await fetch('/api/inventory');
      if (invResponse.ok) {
        const data = await invResponse.json();
        setInventory(data);
      }
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setImportingCsv(false);
      event.target.value = '';
    }
  }

  function renderSortLabel(label, key) {
    if (sortConfig.key !== key) {
      return `${label} / Sort`;
    }

    return `${label} / ${sortConfig.direction === 'asc' ? 'Asc' : 'Desc'}`;
  }
  
   function LastInvUpdate() {
		return <p className="eyebrow">Last document scanned: {visibleDate}</p>;
}

  return (
    <div className="screen">
      <header className="topBar">
        <div>
          <p className="eyebrow">The UPS Store #4166</p>
          <h1>{view === 'analytics' ? 'Analytics' : 'Inventory Table'}</h1>
			  {view === 'inventory' && <LastInvUpdate/> }
        </div>
        <nav className="navMenu" aria-label="Main navigation">
          <button type="button" className={view === 'analytics' ? 'active' : ''} onClick={() => setView('analytics')}>Analytics</button>
          <button type="button" className={view === 'inventory' ? 'active' : ''} onClick={() => setView('inventory')}>Inventory</button>
        </nav>
      </header>

      {view === 'analytics' && <Analytics />}


      {view === 'inventory' && (
        <>
          <section className="controls" aria-label="Search and filters">
            <input
              type="search"
              placeholder="Search SKU or description"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Search inventory"
            />

            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
            >
              {statusOptions.map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>

            <select
              value={sizeFilter}
              onChange={(event) => setSizeFilter(event.target.value)}
              aria-label="Filter by size"
            >
              <option>All Sizes</option>
              <option>Small</option>
              <option>Large</option>
              <option>N/A</option>
            </select>

            <input
              ref={csvInputRef}
              type="file"
              accept=".csv"
              style={{ display: 'none' }}
              onChange={handleCsvImport}
            />
            <button
              type="button"
              className="exportBtn"
              onClick={() => csvInputRef.current.click()}
              disabled={importingCsv}
            >
              {importingCsv ? 'Importing…' : 'Import Sales'}
            </button>

            <button
              type="button"
              className={`exportBtn${showOverride ? ' active' : ''}`}
              onClick={() => {
                setShowOverride((v) => {
                  if (v) setShowBlacklist(false);
                  return !v;
                });
              }}
            >
              {showOverride ? 'Hide Override' : 'Manual Override'}
            </button>

            {showOverride && (
              <button
                type="button"
                className={`exportBtn${showBlacklist ? ' active' : ''}`}
                onClick={() => {
                  setShowBlacklist((v) => {
                    if (!v) loadBlacklist();
                    return !v;
                  });
                }}
              >
                {showBlacklist ? 'Hide Blacklist' : 'Manage Blacklist'}
              </button>
            )}
          </section>

          {error && <p className="emptyState" role="alert">{error}</p>}
          {loading && <p className="emptyState">Loading inventory...</p>}

          {showBlacklist && (
            <section className="tableCard">
              <h2 style={{ padding: '0.75rem 1rem 0' }}>Blacklisted SKUs</h2>
              {blacklistLoading && <p className="emptyState">Loading blacklist...</p>}
              {!blacklistLoading && blacklist.length === 0 && (
                <p className="emptyState">No SKUs are currently blacklisted.</p>
              )}
              {!blacklistLoading && blacklist.length > 0 && (
                <table>
                  <thead>
                    <tr>
                      <th>SKU</th>
                      <th>Description</th>
                      <th>Blacklisted At</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {blacklist.map((entry) => (
                      <tr key={entry.sku}>
                        <td>{entry.sku}</td>
                        <td>{entry.description}</td>
                        <td>{new Date(entry.blacklisted_at).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true })}</td>
                        <td>
                          <button
                            type="button"
                            className="editBtn"
                            onClick={() => unblacklistItem(entry.sku)}
                            disabled={unblacklistingSku === entry.sku}
                          >
                            {unblacklistingSku === entry.sku ? 'Removing...' : 'Remove from Blacklist'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
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
                      <button type="button" className="sortButton" onClick={() => toggleSort('item_quantity')}>
                        {renderSortLabel('On-hand', 'item_quantity')}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sortButton" onClick={() => toggleSort('return_quantity')}>
                        {renderSortLabel('Returns', 'return_quantity')}
                      </button>
                    </th>
                    <th>
                      <button type="button" className="sortButton" onClick={() => toggleSort('status')}>
                        {renderSortLabel('Status', 'status')}
                      </button>
                    </th>
                    {showOverride && <th>Manual Override</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredInventory.map((item) => (
                    <tr key={item.sku} className={item.status !== 'Healthy' ? 'warningRow' : ''}>
                      <td>{item.sku}</td>
                      <td>{item.description}</td>
                      <td>{item.item_quantity}</td>
                      <td>{item.return_quantity}</td>
                      <td>
                        <span className={`status ${item.status.toLowerCase()}`}>{item.status}</span>
                      </td>
                      {showOverride && (
                        <td>
                          <div className="manualOverride">
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={drafts[item.sku] ?? String(item.item_quantity)}
                              onChange={(event) => updateDraft(item.sku, event.target.value)}
                              aria-label={`Manual override for ${item.sku}`}
                            />
                            <button
                              type="button"
                              className="editBtn"
                              onClick={() => saveManualOverride(item)}
                              disabled={savingSku === item.sku}
                            >
                              {savingSku === item.sku ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              type="button"
                              className="deleteBtn"
                              onClick={() => deleteInventoryItem(item)}
                              disabled={deletingSku === item.sku}
                            >
                              {deletingSku === item.sku ? 'Deleting...' : 'Delete'}
                            </button>
                            <button
                              type="button"
                              className="blacklistBtn"
                              onClick={() => blacklistItem(item)}
                              disabled={blacklistingSku === item.sku}
                            >
                              {blacklistingSku === item.sku ? 'Blacklisting...' : 'Blacklist'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredInventory.length === 0 && (
                <p className="emptyState">No products match your search and filter selection.</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

export default App;
