/**
 * HubSpot OAuth Diagnostic Utility
 * Helps debug OAuth connection issues
 */

// HubSpot requires HTTPS redirect URLs - must match HubSpotAuthService
const HUBSPOT_REDIRECT_URI = 'https://heyvata.com/oauth/hubspot/callback.html';

export function getHubSpotDiagnostics() {
  const clientId = process.env.EXPO_PUBLIC_HUBSPOT_CLIENT_ID;
  const clientSecret = process.env.EXPO_PUBLIC_HUBSPOT_CLIENT_SECRET;

  return {
    clientId: clientId ? `${clientId.substring(0, 8)}...` : '❌ NOT SET',
    clientSecret: clientSecret ? '✅ SET' : '❌ NOT SET',
    redirectUri: HUBSPOT_REDIRECT_URI,
    authUrl: `https://app.hubspot.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(HUBSPOT_REDIRECT_URI)}&scope=crm.objects.contacts.write%20oauth%20crm.objects.contacts.read`,
    requiredInHubSpot: [
      'Redirect URL must be exactly:',
      HUBSPOT_REDIRECT_URI,
      '',
      'Required scopes:',
      '- oauth (Required)',
      '- crm.objects.contacts.read',
      '- crm.objects.contacts.write',
      '',
      'Optional scopes:',
      '- crm.schemas.contacts.write',
      '- crm.schemas.deals.read',
      '- crm.objects.deals.read',
      '- crm.objects.deals.write',
      '- crm.objects.companies.read',
      '- crm.objects.companies.write',
      '- crm.schemas.contacts.read',
      '- crm.schemas.companies.read',
      '- timeline',
    ],
    note: 'HubSpot requires HTTPS redirect URLs. Make sure heyvata.com/oauth/hubspot/callback.html is deployed and matches HubSpot app settings.',
  };
}

export function logHubSpotDiagnostics() {
  const diagnostics = getHubSpotDiagnostics();

  console.log('\n===========================================');
  console.log('🔍 HubSpot OAuth Diagnostic Information');
  console.log('===========================================\n');

  console.log('📱 App Configuration:');
  console.log(`  Client ID: ${diagnostics.clientId}`);
  console.log(`  Client Secret: ${diagnostics.clientSecret}`);
  console.log(`  Redirect URI: ${diagnostics.redirectUri}\n`);

  console.log('🔧 HubSpot App Settings Required:');
  diagnostics.requiredInHubSpot.forEach(line => console.log(`  ${line}`));

  console.log('\n⚠️  IMPORTANT:');
  console.log(`  ${diagnostics.note}\n`);

  console.log('🌐 Test Authorization URL:');
  console.log(`  ${diagnostics.authUrl}\n`);

  console.log('===========================================\n');
}
