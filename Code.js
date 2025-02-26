const classSs = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('MCX_CLASS_SPREADSHEET_ID'));
const year13Ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('MCX_YEAR13_SPREADSHEET_ID'));

// OAuth Configuration
const CLIENT_ID = '71193847134-k94t3noiddcoikrvaviua3m3ppjg9uol.apps.googleusercontent.com'; // Replace with your Client ID fr
const CLIENT_SECRET = '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'; // Replace with your Client Secret
const REDIRECT_URI = ScriptApp.getService().getUrl(); // Apps Script URL as redirect URI

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


function doGet2() {
  var service = getOAuthService();

  if (!service.hasAccess()) {
    console.log('User not authenticated, loading login.html');
    return HtmlService.createTemplateFromFile('login')
      .evaluate()
      .setTitle('Login - MCX')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var token = service.getAccessToken();
  var userInfo = getUserInfo(token);

  console.log('User authenticated:', userInfo.email);

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('MCX - Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}


function doGet6() {
  var service = getOAuthService();

  if (!service.hasAccess()) {
    var authUrl = service.getAuthorizationUrl();
    return HtmlService.createHtmlOutput(`
      <script>
        function login() {
          window.open("${authUrl}", "_blank", "width=500,height=600");
        }
      </script>
      <button onclick="login()">Login with Google</button>
    `);
  } else {

  var token = service.getAccessToken();
  var userInfo = getUserInfo(token);

  return HtmlService.createHtmlOutput(`
    <h2>Welcome, ${userInfo.name}!</h2>
    <p>Email: ${userInfo.email}</p>
    <img src="${userInfo.picture}" width="100">
    <br><a href="?logout=true">Logout</a>
  `);
}
}



function doGet4() {
  var service = getOAuthService();

  if (!service.hasAccess()) {
    console.log('User not authenticated, loading Login');
var authUrl = service.getAuthorizationUrl();
    return HtmlService.createHtmlOutput(`
      <script>
        function login() {
          window.open("${authUrl}", "_blank", "width=500,height=600");
        }
      </script>
      <button onclick="login()">Login with Google</button>
    `);
  }
    

   else {
    console.log('User authenticated, loading index.html');
    return HtmlService.createTemplateFromFile('index')
      .evaluate()
      .setTitle('MCX - Dashboard')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }
}

function doGet() {
  var service = getOAuthService();

  if (!service.hasAccess()) {
        console.log('User not authenticated, loading Login');
var authUrl = service.getAuthorizationUrl();
    return HtmlService.createHtmlOutput(`
      <script>
        function login() {
          window.open("${authUrl}", "_blank", "width=500,height=600");
        }
      </script>
      <button onclick="login()">Login with Google</button>
    `);
 
  }

  // User is authenticated, load dashboard
  var token = service.getAccessToken();
  var userInfo = getUserInfo(token);
  
  console.log('User authenticated:', userInfo.email);

  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('MCX - Dashboard')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getUserInfo(token) {
  var url = "https://www.googleapis.com/oauth2/v2/userinfo";
  var response = UrlFetchApp.fetch(url, {
    headers: { Authorization: "Bearer " + token },
    muteHttpExceptions: true
  });

  return JSON.parse(response.getContentText());
}

function authCallback(request) {
  var service = getOAuthService();
  var authorized = service.handleCallback(request);

  if (authorized) {
    return HtmlService.createHtmlOutput("Success! You can close this window.");
  } else {
    return HtmlService.createHtmlOutput("Authorization failed.");
  }
}

function getOAuthService() {
  return OAuth2.createService("GoogleLogin")
    .setAuthorizationBaseUrl("https://accounts.google.com/o/oauth2/auth")
    .setTokenUrl("https://oauth2.googleapis.com/token")
    .setClientId(CLIENT_ID)
    .setClientSecret(CLIENT_SECRET)
    .setCallbackFunction("authCallback")
    .setPropertyStore(PropertiesService.getUserProperties())
    .setScope("https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email")
    .setParam("access_type", "offline");
}

function getOAuthUrl() {
  var service = getOAuthService();
  if (!service.hasAccess()) {
    return service.getAuthorizationUrl();
  }
  return null; // Already authenticated, no need for login
}



function logout() {
  getOAuthService().reset();
}

function getCurrentUser() {
  // const user = Session.getActiveUser(); // Get the User object
  const email = Session.getActiveUser().getEmail();
  const user = AdminDirectory.Users.get(email);

 // let userName = user.getNickname() || user.getEmail(); // Preferred: Nickname or email fallback

  // OR, if you want to try given/family name (may be empty or unavailable):
  //  let userName = user.getGivenName() || "" + " " + user.getFamilyName() || user.getNickname() || user.getEmail();
// let userName = user.getGivenName() ;

  return {
    email: email,
    name: user.name.fullName ,
    role: 'teacher'
  };
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
