/**
 * Quick Reference Guide / Tutorial overlay component.
 * Images live in /public/images/ – swap out the placeholder filenames once
 * the real screenshots are available.
 */
import React, { useEffect, useRef } from 'react';
import './QRG.css';

const SECTIONS = [
  {
    id: 'overview',
    title: '1. Overview',
    body: `This application tracks inventory for The UPS Store #4166. It shows real-time stock levels, flags low or critical items, and automatically updates counts when sales CSV files or order summaries are imported.`,
    image: '/images/placeholder.svg',
    imageAlt: 'Overview screenshot – replace with actual image',
  },
  {
    id: 'inventory',
    title: '2. Inventory Table',
    body: `The Inventory Table lists every tracked SKU with its current on-hand quantity, return quantity, and health status (Healthy / Low / Critical). Use the search box to filter by SKU or description, or use the dropdowns to narrow by status or box size.`,
    image: '/images/placeholder.svg',
    imageAlt: 'Inventory table screenshot – replace with actual image',
  },
  {
    id: 'import',
    title: '3. Importing Sales Data',
    body: `Click Import Sales and select the daily sales CSV file. The system will automatically deduct sold quantities from inventory and skip any blacklisted SKUs. A confirmation banner appears when the import succeeds.`,
    steps: [
      { image: '/images/step1.svg', caption: 'Step 1 – replace with actual image' },
      { image: '/images/step2.svg', caption: 'Step 2 – replace with actual image' },
      { image: '/images/step3.svg', caption: 'Step 3 – replace with actual image' },
      { image: '/images/step4.svg', caption: 'Step 4 – replace with actual image' },
      { image: '/images/step5.svg', caption: 'Step 5 – replace with actual image' },
      { image: '/images/placeholder.svg', caption: 'Step 6 – replace with actual image' },
    ],
  },
  {
    id: 'override',
    title: '4. Manual Override',
    body: `Toggle Manual Override to reveal inline editing controls next to every row. Type a corrected quantity and click Save to update that item immediately. You can also Delete an item entirely (with a confirmation prompt) or Blacklist it to prevent it from being re-imported in the future.`,
    image: '/images/placeholder.svg',
    imageAlt: 'Manual override screenshot – replace with actual image',
  },
  {
    id: 'blacklist',
    title: '5. Blacklist Management',
    body: `With Manual Override active, click Manage Blacklist to view every currently blacklisted SKU. Use the Remove from Blacklist button to reinstate a SKU – it will be eligible for future CSV imports but will not be added back to inventory automatically.`,
    image: '/images/placeholder.svg',
    imageAlt: 'Blacklist management screenshot – replace with actual image',
  },
  {
    id: 'analytics',
    title: '6. Analytics',
    body: `Switch to the Analytics view for historical trends, top-selling SKUs, and days-of-supply calculations. Use the parameter controls to adjust thresholds and the search bar to focus on a specific product.`,
    image: '/images/placeholder.svg',
    imageAlt: 'Analytics screenshot – replace with actual image',
  },
  {
    id: 'watcher',
    title: '7. Automated File Watcher',
    body: `A background service monitors the designated network folder for new order summary PDFs and count-sheet CSV files. When a file is detected it is parsed automatically and inventory is updated without any manual steps. Ensure the watched folder path is configured correctly in the back-end settings.`,
    image: '/images/placeholder.svg',
    imageAlt: 'File watcher diagram – replace with actual image',
  },
];

export default function QRG({ onClose }) {
  const overlayRef = useRef(null);

  // Close on Escape key
  useEffect(() => {
    function handleKey(e) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  // Trap focus inside overlay
  function handleBackdropClick(e) {
    if (e.target === overlayRef.current) onClose();
  }

  return (
    <div className="qrgOverlay" ref={overlayRef} onClick={handleBackdropClick} role="dialog" aria-modal="true" aria-label="Quick Reference Guide">
      <div className="qrgDialog">
        <div className="qrgHeader">
          <h2 className="qrgTitle">Quick Reference Guide</h2>
          <button type="button" className="qrgClose" onClick={onClose} aria-label="Close guide">✕</button>
        </div>

        <div className="qrgBody">
          {SECTIONS.map((section) => (
            <article key={section.id} className="qrgSection">
              <h3 className="qrgSectionTitle">{section.title}</h3>
              <p className="qrgSectionText">{section.body}</p>

              {section.steps ? (
                /* Import section: 6-image step grid */
                <div className="qrgStepsGrid">
                  {section.steps.map((step, i) => (
                    <div key={i} className="qrgStepCard">
                      <div className="qrgStepNumber">{i + 1}</div>
                      <div className="qrgImageWrap">
                        <img src={step.image} alt={step.caption} className="qrgImage" />
                        <p className="qrgImageCaption">{step.caption}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* All other sections: single image */
                <div className="qrgImageWrap">
                  <img src={section.image} alt={section.imageAlt} className="qrgImage" />
                  <p className="qrgImageCaption">{section.imageAlt}</p>
                </div>
              )}
            </article>
          ))}
        </div>

        <div className="qrgFooter">
          <button type="button" className="qrgCloseBtn" onClick={onClose}>Close Guide</button>
        </div>
      </div>
    </div>
  );
}
