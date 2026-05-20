/**
 * GitHub Pages project sites break relative URLs when the path has no trailing slash
 * (e.g. /DataVis vs /DataVis/). Redirect directory URLs to a trailing slash first.
 */
(function () {
  var path = location.pathname;
  if (!path.endsWith('/') && !/\.[a-z0-9]+$/i.test(path)) {
    location.replace(path + '/' + location.search + location.hash);
  }
})();
