import React, { useMemo, useState } from 'react';
import './App.css';

const inventorySeed = [
  {
    sku: 'BX-12X12X12',
    product: 'Standard Shipping Box 12x12x12',
    vendor: 'UPS Supply',
    onHand: 84,
    reorderPoint: 60,
    last30Used: 42,
    location: 'Aisle A / Rack 2',
    status: 'Healthy',
  },
  {
    sku: 'BX-18X18X16',
    product: 'Moving Box 18x18x16',
    vendor: 'UPS Supply',
    onHand: 27,
    reorderPoint: 35,
    last30Used: 51,
    location: 'Backroom Pallet 1',
    status: 'Low',
  },
  {
    sku: 'MAT-BUBBLE-750',
    product: 'Bubble Cushioning Roll 750 ft',
    vendor: 'Uline',
    onHand: 9,
    reorderPoint: 8,
    last30Used: 6,
    location: 'Aisle C / Shelf 4',
    status: 'Healthy',
  },
  {
    sku: 'MAT-TAPE-2IN',
    product: '2in Packing Tape',
    vendor: '3M Distributor',
    onHand: 14,
    reorderPoint: 20,
    last30Used: 33,
    location: 'Front Counter Bin',
    status: 'Low',
  },
  {
    sku: 'MAT-KRAFT-30LB',
    product: 'Kraft Packing Paper 30 lb',
    vendor: 'UPS Supply',
    onHand: 41,
    reorderPoint: 25,
    last30Used: 18,
    location: 'Aisle B / Shelf 1',
    status: 'Healthy',
  },
  {
    sku: 'MAILER-POLY-L',
    product: 'Large Poly Mailer',
    vendor: 'Uline',
    onHand: 6,
    reorderPoint: 15,
    last30Used: 24,
    location: 'Aisle C / Bin 7',
    status: 'Critical',
  },
];

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [vendorFilter, setVendorFilter] = useState('All Vendors');
  const [statusFilter, setStatusFilter] = useState('All Statuses');
  const [sizeFilter, setSizeFilter] = useState('All Sizes');

  const vendors = useMemo(() => {
    return ['All Vendors', ...new Set(inventorySeed.map(item => item.vendor))];
  }, []);

  const statusOptions = ['All Statuses', 'Healthy', 'Low', 'Critical'];

  const sizeFromName = (name) => {
    if (name.toLowerCase().includes('12x12x12')) return 'Small';
    if (name.toLowerCase().includes('18x18x16')) return 'Large';
    return 'N/A';
  };

  const filteredInventory = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();

    return inventorySeed.filter(item => {
      const matchesSearch =
        term.length === 0 ||
        item.sku.toLowerCase().includes(term) ||
        item.product.toLowerCase().includes(term) ||
        item.location.toLowerCase().includes(term);

      const matchesVendor =
        vendorFilter === 'All Vendors' || item.vendor === vendorFilter;

      const matchesStatus =
        statusFilter === 'All Statuses' || item.status === statusFilter;

      const sizeLabel = sizeFromName(item.product);
      const matchesSize = sizeFilter === 'All Sizes' || sizeLabel === sizeFilter;

      return matchesSearch && matchesVendor && matchesStatus && matchesSize;
    });
  }, [searchTerm, vendorFilter, statusFilter, sizeFilter]);

  return (
    <div className="screen">
      <header className="topBar">
        <div>
          <p className="eyebrow">The UPS Store #4166</p>
          <h1>Inventory Table</h1>
        </div>
        <nav className="navMenu" aria-label="Main navigation">
          <button type="button">Dashboard</button>
          <button type="button" className="active">Inventory</button>
          <button type="button">Orders</button>
          <button type="button">Alerts</button>
        </nav>
      </header>

      <section className="controls" aria-label="Search and filters">
        <input
          type="search"
          placeholder="Search SKU, product, or location"
          value={searchTerm}
          onChange={(event) => setSearchTerm(event.target.value)}
          aria-label="Search inventory"
        />

        <select
          value={vendorFilter}
          onChange={(event) => setVendorFilter(event.target.value)}
          aria-label="Filter by vendor"
        >
          {vendors.map(vendor => (
            <option key={vendor} value={vendor}>{vendor}</option>
          ))}
        </select>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
          aria-label="Filter by status"
        >
          {statusOptions.map(status => (
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

        <button
          type="button"
          className="exportBtn"
          onClick={() => window.alert('Export module hook: connect CSV/PDF download here.')}
        >
          Download / Export
        </button>
      </section>

      <section className="tableCard">
        <table>
          <thead>
            <tr>
              <th>SKU</th>
              <th>Product</th>
              <th>Vendor</th>
              <th>On-hand</th>
              <th>Reorder Point</th>
              <th>Last 30 Used</th>
              <th>Location</th>
              <th>Status</th>
              <th>View / Edit</th>
            </tr>
          </thead>
          <tbody>
            {filteredInventory.map((item) => {
              const isBelowReorder = item.onHand <= item.reorderPoint;
              return (
                <tr key={item.sku} className={isBelowReorder ? 'warningRow' : ''}>
                  <td>{item.sku}</td>
                  <td>{item.product}</td>
                  <td>{item.vendor}</td>
                  <td>{item.onHand}</td>
                  <td>{item.reorderPoint}</td>
                  <td>{item.last30Used}</td>
                  <td>{item.location}</td>
                  <td>
                    <span className={`status ${item.status.toLowerCase()}`}>{item.status}</span>
                  </td>
                  <td>
                    <button
                      type="button"
                      className="editBtn"
                      onClick={() => window.alert(`Manual override hook for ${item.sku}`)}
                    >
                      Open
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {filteredInventory.length === 0 && (
          <p className="emptyState">No products match your search and filter selection.</p>
        )}
      </section>
    </div>
  );
}

export default App;
