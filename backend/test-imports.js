// Test script to check imports
async function testImports() {
  try {
    console.log('Testing imports...\n');

    const modules = [
      './src/routes/auth',
      './src/routes/lookups',
      './src/routes/quadrants',
      './src/routes/airports',
      './src/routes/locations',
      './src/routes/teams',
      './src/routes/species',
      './src/routes/aircraftModels',
      './src/routes/movements',
      './src/routes/sightings',
      './src/routes/strikes',
      './src/routes/controlActions',
      './src/routes/attractors',
      './src/routes/kpis',
      './src/routes/reports',
      './src/routes/compliance',
      './src/routes/analytics',
      './src/routes/users'
    ];

    for (const modulePath of modules) {
      try {
        const mod = await import(modulePath);
        const exportedFunctions = Object.keys(mod).filter(key => typeof mod[key] === 'function');
        console.log(`✓ ${modulePath}: ${exportedFunctions.join(', ') || 'NO FUNCTIONS'}`);
      } catch (error) {
        console.log(`✗ ${modulePath}: ERROR - ${error.message}`);
      }
    }
  } catch (error) {
    console.error('Fatal error:', error);
  }
}

testImports();
