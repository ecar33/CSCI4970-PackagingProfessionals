import React from 'react';
import ReactDOM from 'react-dom';
import './ConfirmModal.css';

function BlacklistModal({ blacklist, loading, unblacklistingSku, onUnblacklist, onClose }) {
  return ReactDOM.createPortal(
    <div className="modalBackdrop" onClick={onClose}>
      <div className="modalBox blacklistModalBox" onClick={(e) => e.stopPropagation()}>
        <div className="blacklistModalHeader">
          <h2 className="modalTitle">Blacklisted SKUs</h2>
          <button type="button" className="modalClose" onClick={onClose} aria-label="Close">×</button>
        </div>

        {loading && <p className="emptyState">Loading blacklist...</p>}
        {!loading && blacklist.length === 0 && (
          <p className="emptyState">No SKUs are currently blacklisted.</p>
        )}
        {!loading && blacklist.length > 0 && (
          <div className="blacklistModalTableWrap">
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
                  <tr key={entry.sku} className={unblacklistingSku === entry.sku ? 'deletingRow' : 'rowFadeIn'}>
                    <td>{entry.sku}</td>
                    <td>{entry.description}</td>
                    <td>{new Date(entry.blacklisted_at).toLocaleString('en-US', {
                      month: 'short', day: 'numeric', year: 'numeric',
                      hour: 'numeric', minute: '2-digit', hour12: true,
                    })}</td>
                    <td>
                      <button
                        type="button"
                        className="editBtn"
                        onClick={() => onUnblacklist(entry.sku)}
                        disabled={unblacklistingSku === entry.sku}
                      >
                        {unblacklistingSku === entry.sku ? 'Removing...' : 'Remove from Blacklist'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}

export default BlacklistModal;
