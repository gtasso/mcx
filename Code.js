const classSs = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('MCX_CLASS_SPREADSHEET_ID'));
const year13Ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('MCX_YEAR13_SPREADSHEET_ID'));

// OAuth Configuration
const CLIENT_ID = '71193847134-k94t3noiddcoikrvaviua3m3ppjg9uol.apps.googleusercontent.com'; // Replace with your Client ID from OAuth credentials
const CLIENT_SECRET = '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'; // Replace with your Client Secret
const REDIRECT_URI = ScriptApp.getService().getUrl(); // Apps Script URL as redirect URI


function doGet(e) {
  console.log('doGet called with parameters:', JSON.stringify(e.parameter));
  const user = getCurrentUser();
  console.log('Current user:', user ? JSON.stringify(user) : 'No user');
  if (!user) {
    console.log('User not authenticated, serving login.html');
    return HtmlService.createTemplateFromFile('login')
      .evaluate()
      .setTitle('MCX - Login')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  console.log('User authenticated, serving index.html');
  const template = HtmlService.createTemplateFromFile('index');
  template.user = user;
  return template
    .evaluate()
    .setTitle('MCX')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getOAuthUrl() {
  const service = getOAuthService();
  console.log('getOAuthUrl called, hasAccess:', service.hasAccess());
  if (service.hasAccess()) {
    console.log('User already has access, returning null');
    return null;
  }
  const url = service.getAuthorizationUrl();
  console.log('Generated OAuth URL:', url);
  return url;
}

function getOAuthService() {
  return OAuth2.createService('google')
    .setAuthorizationBaseUrl('https://accounts.google.com/o/oauth2/auth')
    .setTokenUrl('https://oauth2.googleapis.com/token')
    .setClientId(CLIENT_ID)
    .setClientSecret(CLIENT_SECRET)
    .setCallbackFunction('authCallback') // Required for library-managed callback
    .setPropertyStore(PropertiesService.getUserProperties())
    .setScope('https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile')
    .setParam('access_type', 'offline')
    .setParam('prompt', 'consent');
}

function authCallback(request) {
  console.log('authCallback called with request:', JSON.stringify(request));
  const service = getOAuthService();
  const isAuthorized = service.handleCallback(request);
  console.log('Authorization result:', isAuthorized);
  if (isAuthorized) {
    const redirectUrl = ScriptApp.getService().getUrl();
    console.log('Redirecting to:', redirectUrl);
    return HtmlService.createHtmlOutput('<script>window.top.location.href="' + redirectUrl + '";</script>');
  } else {
    console.error('Authorization failed');
    return HtmlService.createHtmlOutput('Authorization failed. Please try again.');
  }
}

function getCurrentUser() {
  const service = getOAuthService();
  if (!service.hasAccess()) {
    return null;
  }

  const url = 'https://www.googleapis.com/oauth2/v2/userinfo';
  const response = UrlFetchApp.fetch(url, {
    headers: {
      Authorization: 'Bearer ' + service.getAccessToken()
    }
  });

  const userInfo = JSON.parse(response.getContentText());
  return {
    email: userInfo.email,
    name: userInfo.name || userInfo.email.split('@')[0],
    picture: userInfo.picture,
    role: 'teacher'
  };
}

function logout() {
  const service = getOAuthService();
  service.reset();
  return true;
}

// Existing Functions (unchanged unless noted)
function generateYearOptions() {
  let optionsHtml = '<option value="" disabled selected></option>';
  for (let i = 1; i <= 13; i++) {
    optionsHtml += `<option value="${i}">Year ${i}</option>`;
  }
  return optionsHtml;
}

function createClass(classData) {
  console.log('Received class data:', JSON.stringify(classData));
  try {
    const sheet = classSs.getSheetByName('Classes');
    if (!sheet) throw new Error('"Classes" sheet not found in the spreadsheet');
    
    const id = Utilities.getUuid().toLowerCase();
    const timestamp = new Date();
    const user = getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    
    sheet.appendRow([
      id,
      classData.name || 'Unnamed Class',
      classData.subject || '',
      classData.yearlevel || '',
      user.email,
      timestamp,
      'false'
    ]);

    console.log('Successfully created class with ID:', id);
    return true;
  } catch (error) {
    console.error('Create Class Error:', error);
    throw new Error('Failed to create class: ' + error.message);
  }
}

function getClasses() {
  const user = getCurrentUser();
  if (!user) throw new Error('User not authenticated');

  const sheet = classSs.getSheetByName('Classes');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  return data
    .map(row => ({
      classid: row[0],
      classname: row[1],
      subject: row[2],
      section: row[3],
      owner: row[4],
      created: row[5] ? row[5].toISOString() : '',
      archived: row[6] || "FALSE"
    }))
    .filter(cls => cls.archived.toString().toUpperCase() === "FALSE" && cls.owner === user.email);
}

function getSlo(classid) {
  if (!classid || typeof classid !== 'string') {
    console.error('Invalid classid:', classid);
    throw new Error('Invalid class ID provided');
  }

  const sheet = year13Ss.getSheetByName('SLO');
  if (!sheet) {
    throw new Error('"SLO" sheet not found in the spreadsheet');
  }

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();

  return data
    .map(row => ({
      strandcode: row[0],
      substrandcode: row[1],
      klo: row[2],
      slocode: row[3],
      slo: row[4],
      classid: row[5]
    }))
    .filter(slo => slo.classid === classid);
}
