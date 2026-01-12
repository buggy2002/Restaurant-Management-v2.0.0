import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import dotenv from 'dotenv';

dotenv.config({ path: '.env' });

async function testConnection() {
  console.log('Testing Google Sheets Connection...');
  console.log('Email:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL);
  console.log('Sheet ID:', process.env.GOOGLE_SPREADSHEET_ID);

  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !process.env.GOOGLE_PRIVATE_KEY || !process.env.GOOGLE_SPREADSHEET_ID) {
    console.error('ERROR: Missing environment variables.');
    return;
  }

  try {
    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();
    console.log('SUCCESS: Connected to spreadsheet:', doc.title);

    console.log('Sheets found:');
    for (let i = 0; i < doc.sheetCount; i++) {
      const sheet = doc.sheetsByIndex[i];
      console.log(`- ${sheet.title} (Rows: ${sheet.rowCount})`);
      const rows = await sheet.getRows({ limit: 5 });
      console.log(`  First 5 rows of ${sheet.title}:`);
      rows.forEach(row => {
        console.log(`  - ${JSON.stringify(row.toObject())}`);
      });
    }

  } catch (error) {
    console.error('CONNECTION FAILED:', error);
  }
}

testConnection();
