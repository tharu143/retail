import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * ScrollToTop - Resets scroll position to the top of the page
 * whenever the route (pathname) changes.
 */
function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    const resetScroll = () => {
      // Scroll window
      window.scrollTo(0, 0);

      // Scroll main content scrollable panel and layout containers
      const scrollContainers = document.querySelectorAll(
        '.right-content-panel, .so-page, .so-content, .dashboard-layout-wrapper'
      );
      scrollContainers.forEach(container => {
        if (container) {
          container.scrollTop = 0;
        }
      });
    };

    // Reset immediately
    resetScroll();

    // Reset again after a brief delay to override any browser default scroll-restoration
    const timer = setTimeout(resetScroll, 50);

    return () => clearTimeout(timer);
  }, [pathname]);


  return null;
}

export default ScrollToTop;

