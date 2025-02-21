
const classSs = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('MCX_CLASS_SPREADSHEET_ID'));
// const year13Ss = SpreadsheetApp.openById(PropertiesService.getScriptProperties().getProperty('MCX_YEAR13_SPREADSHEET_ID'));

function doGet() {
  // return HtmlService.createHtmlOutputFromFile('Index')
  return HtmlService.createTemplateFromFile('index')

    .evaluate()
    .setTitle('Classroom Clone')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}


function generateYearOptions() {
  let optionsHtml = '<option value="" disabled selected></option>';
  for (let i = 1; i <= 13; i++) {
    optionsHtml += `<option value="${i}">Year ${i}</option>`;
  }
  return optionsHtml;
}

// CLASS FUNCTIONS

function createClass(classData) {
   console.log('Received class data:', JSON.stringify(classData));
  try {
    const sheet = classSs.getSheetByName('Classes');
    if (!sheet) throw new Error('"Classes" sheet not found in the spreadsheet');
    
    const id = Utilities.getUuid().toLowerCase();
    const timestamp = new Date();
    const userEmail = Session.getActiveUser().getEmail();
    
    sheet.appendRow([
      id,
      classData.name || 'Unnamed Class',
      classData.subject || '',
      classData.yearlevel || '',
      userEmail,
      timestamp,
      'false'
    ]);

      console.log('Successfully created class with ID:', id);
    // Return simple confirmation
    return true;
    
  } catch (error) {
    console.error('Create Class Error:', error);
    throw new Error('Failed to create class: ' + error.message);
  }
}

function getClasses() {
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
      archived: row[6] || "FALSE" // Assuming archived status is in column G (7th column)
    }))
    .filter(cls => cls.archived.toString().toUpperCase() === "FALSE");
}


// ASSIGNMENT FUNCTIONS
function createAssignment(assignmentData) {
  const sheet = classSs.getSheetByName('Assignments');
  const id = Utilities.getUuid();
  const timestamp = new Date();
  
  sheet.appendRow([
    id,
    assignmentData.classId,
    assignmentData.title,
    assignmentData.description,
    assignmentData.dueDate,
    assignmentData.points,
    timestamp
  ]);
  
  return { status: 'success', assignmentId: id };
}

function getAssignments(classId) {
  const sheet = classSs.getSheetByName('Assignments');
  const data = sheet.getDataRange().getValues();
  const headers = data.shift();
  
  return data
    .filter(row => row[1] === classId)
    .map(row => ({
      assignmentId: row[0],
      title: row[2],
      description: row[3],
      dueDate: row[4],
      points: row[5],
      created: row[6]
    }));
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

// Add to existing code
const DRIVE_FOLDER_ID = '1fHR9F40aL6wcwD_7vQjkNlJLXr1gRNXe';

// Enrollment Functions
function generateClassCode(classId) {
  const code = Utilities.getUuid().substring(0,8);
  const cache = CacheService.getScriptCache();
  cache.put(code, classId, 21600); // 6-hour expiration
  return code;
}

function enrollStudent(code, studentEmail) {
  const cache = CacheService.getScriptCache();
  const classId = cache.get(code);
  
  if (!classId) throw new Error('Invalid class code');
  
  const sheet = classSs.getSheetByName('Enrollments');
  sheet.appendRow([
    Utilities.getUuid(),
    classId,
    studentEmail,
    new Date(),
    'enrolled'
  ]);
  
  return { status: 'success', classId };
}

// Submission Functions
function submitAssignment(assignmentId, studentEmail, fileBlob) {
  const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
  const file = folder.createFile(fileBlob);
  
  const sheet = classSs.getSheetByName('Submissions');
  sheet.appendRow([
    Utilities.getUuid(),
    assignmentId,
    studentEmail,
    file.getUrl(),
    new Date(),
    '', // Empty grade
    '' // Empty feedback
  ]);
  
  return { status: 'success' };
}

function gradeSubmission(submissionId, grade, feedback) {
  const props = PropertiesService.getScriptProperties();
  const sheet = classSs.getSheetByName('Submissions');
  const data = sheet.getDataRange().getValues();
  
  // Get submission details
  const row = data.find(row => row[0] === submissionId);
  const [,, studentEmail, , , ,] = row;

  // Get assignment details
  const assignment = getAssignmentDetails(row[1]);
  
  // Get email templates
  const subject = props.getProperty('EMAIL_SUBJECT_GRADED')
    .replace('{ASSIGNMENT_TITLE}', assignment.title);
    
  const body = props.getProperty('EMAIL_BODY_GRADED')
    .replace('{STUDENT_NAME}', studentEmail.split('@')[0])
    .replace('{ASSIGNMENT_TITLE}', assignment.title)
    .replace('{GRADE}', grade)
    .replace('{MAX_POINTS}', assignment.maxPoints)
    .replace('{FEEDBACK}', feedback)
    .replace('{TEACHER_NAME}', Session.getActiveUser().getEmail().split('@')[0]);

  GmailApp.sendEmail(
    studentEmail,
    subject,
    '',
    {
      name: props.getProperty('EMAIL_SENDER_NAME'),
      htmlBody: body
    }
  );
  
  return { status: 'success' };
}

function getAssignmentDetails(assignmentId) {
  const sheet = classSs.getSheetByName('Assignments');
  const data = sheet.getDataRange().getValues();
  const assignment = data.find(row => row[0] === assignmentId);
  
  return {
    title: assignment[2],
    maxPoints: assignment[5],
    dueDate: assignment[4]
  };
}



// Calendar Integration
function createCalendarEvent(assignmentData) {
  const calendar = CalendarApp.getDefaultCalendar();
  const event = calendar.createEvent(
    `Assignment Due: ${assignmentData.title}`,
    new Date(assignmentData.dueDate),
    new Date(assignmentData.dueDate),
    { description: assignmentData.description }
  );
  return event.getId();
}

// Role Management
function getUserRole(email) {
  const sheet = classSs.getSheetByName('Users');
  const data = sheet.getDataRange().getValues();
  const user = data.find(row => row[0] === email);
  return user ? user[1] : 'student';
}

// Discussion/Announcement Functions
function createPost(postData) {
  const sheet = classSs.getSheetByName('Posts');
  let fileUrl = '';
  
  if (postData.file) {
    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const file = folder.createFile(postData.file);
    fileUrl = file.getUrl();
  }
  
  sheet.appendRow([
    Utilities.getUuid(),
    postData.classId,
    postData.author,
    postData.content,
    postData.type,
    fileUrl,
    new Date()
  ]);
  
  return { status: 'success' };
}


function archiveClass(classid) {
 if (!classid || typeof classid !== 'string') {
    throw new Error('Invalid class ID');
  }

  try {
    const sheet = classSs.getSheetByName('Classes');
    const data = sheet.getDataRange().getValues();
    const headers = data.shift(); // Remove header row

    // Find the correct row index
    const rowIndex = data.findIndex(row => row[0] === classid);
    
    if (rowIndex === -1) {
      console.error('Class not found. Searching for:', classId);
      console.log('Existing class IDs:', data.map(row => row[0]));
      throw new Error('Class not found');
    }

    // Update column G (7th column) in the correct row
    const sheetRow = rowIndex + 2; // Add 2 because data starts at row 2 (header is row 1)
    sheet.getRange(sheetRow, 7).setValue("TRUE");
    
    return { status: 'success' };
  } catch (error) {
    console.error('Archive error:', error);
    throw new Error('Failed to archive class: ' + error.message);
  }
}