// ============================================================
// Google Apps Script — LINE Login + User Management
// Deploy: ส่วนขยาย > Apps Script > ทำให้ใช้งานได้ > เว็บแอป
// Execute as: ตัวคุณเอง | Who has access: ทุกคน
// ============================================================

const SHEET_ID = '13n2T_ZH7K-av4hRa1Q1iHLoyn-GV-XeeQ9m3mxUnT_8';
const LINE_CHANNEL_ID = '2010908089';
const LINE_CHANNEL_SECRET = 'YOUR_CHANNEL_SECRET'; // <-- ใส่ Channel Secret ที่นี่

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;

    if (action === 'login') {
      return handleLogin(body.code, body.redirectUri);
    }
    if (action === 'check') {
      return handleCheck(body.userId);
    }

    return jsonResponse({ error: 'unknown action' });
  } catch (err) {
    return jsonResponse({ error: err.message });
  }
}

function doGet(e) {
  return jsonResponse({ status: 'ok', message: 'LINE User Management API' });
}

// --- LOGIN: แลก code → token → profile → บันทึก sheet → ตรวจสิทธิ์ ---
function handleLogin(code, redirectUri) {
  // 1) แลก authorization code เป็น access token
  const tokenRes = UrlFetchApp.fetch('https://api.line.me/oauth2/v2.1/token', {
    method: 'post',
    payload: {
      grant_type: 'authorization_code',
      code: code,
      redirect_uri: redirectUri,
      client_id: LINE_CHANNEL_ID,
      client_secret: LINE_CHANNEL_SECRET
    },
    muteHttpExceptions: true
  });

  const tokenData = JSON.parse(tokenRes.getContentText());
  if (tokenData.error) {
    return jsonResponse({ error: 'token_error', detail: tokenData.error_description || tokenData.error });
  }

  // 2) ดึง profile จาก LINE
  const profileRes = UrlFetchApp.fetch('https://api.line.me/v2/profile', {
    headers: { Authorization: 'Bearer ' + tokenData.access_token },
    muteHttpExceptions: true
  });

  const profile = JSON.parse(profileRes.getContentText());
  if (!profile.userId) {
    return jsonResponse({ error: 'profile_error' });
  }

  // 3) บันทึกลง Google Sheet
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName('users');
  if (!sheet) {
    sheet = ss.insertSheet('users');
    sheet.appendRow(['LINE User ID', 'Display Name', 'Picture URL', 'First Login', 'Last Login', 'Active']);
    sheet.getRange('A1:F1').setFontWeight('bold');
    sheet.setFrozenRows(1);
  }

  const data = sheet.getDataRange().getValues();
  let rowIndex = -1;
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === profile.userId) {
      rowIndex = i + 1;
      break;
    }
  }

  const now = Utilities.formatDate(new Date(), 'Asia/Bangkok', 'yyyy-MM-dd HH:mm:ss');

  if (rowIndex === -1) {
    // ผู้ใช้ใหม่ — เพิ่มแถว, default Active = NO (ต้องรอ admin อนุมัติ)
    sheet.appendRow([
      profile.userId,
      profile.displayName,
      profile.pictureUrl || '',
      now,
      now,
      'NO'
    ]);
    return jsonResponse({
      status: 'pending',
      displayName: profile.displayName,
      pictureUrl: profile.pictureUrl || '',
      userId: profile.userId,
      message: 'รอผู้ดูแลระบบอนุมัติสิทธิ์'
    });
  } else {
    // ผู้ใช้เดิม — อัปเดต last login + ชื่อ/รูป
    sheet.getRange(rowIndex, 2).setValue(profile.displayName);
    sheet.getRange(rowIndex, 3).setValue(profile.pictureUrl || '');
    sheet.getRange(rowIndex, 5).setValue(now);

    const active = String(data[rowIndex - 1][5]).toUpperCase().trim();
    if (active === 'YES') {
      return jsonResponse({
        status: 'active',
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl || '',
        userId: profile.userId
      });
    } else {
      return jsonResponse({
        status: 'pending',
        displayName: profile.displayName,
        pictureUrl: profile.pictureUrl || '',
        userId: profile.userId,
        message: 'บัญชีของคุณยังไม่ได้รับอนุมัติสิทธิ์'
      });
    }
  }
}

// --- CHECK: ตรวจสิทธิ์ user ---
function handleCheck(userId) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName('users');
  if (!sheet) return jsonResponse({ status: 'no_sheet' });

  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === userId) {
      const active = String(data[i][5]).toUpperCase().trim();
      return jsonResponse({
        status: active === 'YES' ? 'active' : 'pending',
        displayName: data[i][1],
        pictureUrl: data[i][2] || ''
      });
    }
  }
  return jsonResponse({ status: 'not_found' });
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
