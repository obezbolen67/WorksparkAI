// src/components/Portal.tsx
import { useEffect, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface PortalProps {
  children: ReactNode;
}

/**
 * A component that renders its children into a "portal" DOM node,
 * typically `div#portal-root` in the main HTML file. This is useful for
 * modals, tooltips, and other elements that need to appear on top of
 * the main application UI without being clipped by parent overflow styles.
 */
const Portal = ({ children }: PortalProps) => {
  // State to hold the portal container DOM element.
  const [container, setContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // This effect runs on the client after the component mounts.
    // It finds the portal root element in the document.
    let portalRoot = document.getElementById('portal-root');
    
    // If the portal root doesn't exist for some reason, create it dynamically.
    if (!portalRoot) {
        const newPortalRoot = document.createElement('div');
        newPortalRoot.id = 'portal-root';
        document.body.appendChild(newPortalRoot);
        portalRoot = newPortalRoot;
    }
    
    // Set the container in state.
    setContainer(portalRoot);

    // The cleanup function is not strictly necessary here, but it's good practice.
    // We don't want to remove the portalRoot as other components might use it.
  }, []); // The empty dependency array ensures this runs only once on mount.

  // If the container has been found, create a portal and render the children into it.
  // Otherwise, render nothing (this prevents errors during server-side rendering or initial mount).
  return container ? createPortal(children, container) : null;
};

export default Portal;