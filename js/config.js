(() => {
  window.APP_CONFIG = {
    apiUrl: '/api/hotspots',  
    fallbackToMock: true,
    defaults: { distKm: 1, hours: 3, persistDays: 3, persistKm: 1, hidePersistent: false },
    colors: { M: '#D55E00', V: '#0072B2', B: '#E69F00' },
  };
})(); 