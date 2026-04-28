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
  },
  {
    id: 'inventory',
    title: '2. Inventory Table',
    body: `The Inventory Table lists every tracked SKU with its current on-hand quantity, return quantity, and health status (Healthy / Low / Critical). Use the search box to filter by SKU or description, or use the dropdowns to narrow by status or box size.`,
  },
  {
    id: 'import',
    title: '3. Importing Sales Data',
    body: `Click Import Sales and select the daily sales CSV file. The system will automatically deduct sold quantities from inventory and skip any blacklisted SKUs.`,
    steps: [
      { image: '/images/step1.png', caption: 'Step 1 – Login to Team Portal and select FRS' },
      { image: '/images/step2.png', caption: 'Step 2 – Select POS Reports' },
      { image: '/images/step3.png', caption: 'Step 3 – Select Item Sales' },
      { image: '/images/step4.png', caption: 'Step 4 – Select Retail Shipping Supplies, set date range, and select Go' },
      { image: '/images/step5.png', caption: 'Step 5 – Click save icon and export as CSV (comma delimited)' },
      { image: '/images/step6.png', caption: 'Step 6 – Click Import Sales and select the itemsaves.csv for upload' },
    ],
  },
  {
    id: 'override',
    title: '4. Manual Override',
    body: `Toggle Manual Override to reveal inline editing controls next to every row. Type a corrected quantity and click Save to update that item immediately. You can also Delete an item entirely (with a confirmation prompt) or Blacklist it to prevent it from being re-imported in the future.`,
    image: '/images/override.png',
    imageAlt: 'Manual override screenshot',
  },
  {
    id: 'blacklist',
    title: '5. Blacklist Management',
    body: `With Manual Override active, click Manage Blacklist to view every currently blacklisted SKU. Use the Remove from Blacklist button to reinstate a SKU – it will be eligible for future CSV imports but will not be added back to inventory automatically.`,
    image: '/images/blacklist.png',
    imageAlt: 'Blacklist management screenshot',
  },
  {
    id: 'analytics',
    title: '6. Analytics',
    body: `Switch to the Analytics view for historical trends, top-selling SKUs, and days-of-supply calculations. Use the parameter controls to adjust thresholds and the search bar to focus on a specific product.`,
    image: '/images/analytics.png',
    imageAlt: 'Analytics screenshot',
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
              ) : section.image ? (
                /* All other sections: single image */
                <div className="qrgImageWrap">
                  <img src={section.image} alt={section.imageAlt} className="qrgImage" />
                  <p className="qrgImageCaption">{section.imageAlt}</p>
                </div>
              ) : null}
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
