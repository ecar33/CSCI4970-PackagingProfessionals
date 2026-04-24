import React from 'react';
import ReactDOM from 'react-dom';
import './ConfirmModal.css';

function ConfirmModal({ message, onConfirm, onCancel, alertOnly = false, title }) {
  const dismiss = alertOnly ? onConfirm : onCancel;
  return ReactDOM.createPortal(
    <div className="modalBackdrop" onClick={dismiss}>
      <div className={`modalBox${alertOnly ? ' modalAlert' : ''}`} onClick={(e) => e.stopPropagation()}>
        {title && <p className="modalTitle">{title}</p>}
        <p className="modalMessage">{message}</p>
        <div className="modalActions">
          {!alertOnly && <button type="button" className="modalCancel" onClick={onCancel}>Cancel</button>}
          <button type="button" className="modalConfirm" onClick={onConfirm}>
            {alertOnly ? 'Got it' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}

export default ConfirmModal;
