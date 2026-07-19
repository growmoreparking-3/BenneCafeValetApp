const { google } = require('googleapis');
const fs = require('fs');
const path = require('path');
const stream = require('stream');

// Google Drive Folder ID from the shared link
const DRIVE_FOLDER_ID = '1bEzlAaDsu0aNKflPUf-ajR2pI4LTwgnD';

// Initialize Google Drive API
let drive = null;

const initializeDrive = () => {
  try {
    // Check if credentials are provided
    if (!process.env.GOOGLE_DRIVE_CREDENTIALS) {
      console.warn('⚠ Google Drive not configured - using local storage');
      return null;
    }

    const credentials = JSON.parse(process.env.GOOGLE_DRIVE_CREDENTIALS);
    
    const auth = new google.auth.GoogleAuth({
      credentials,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    });

    drive = google.drive({ version: 'v3', auth });
    console.log('✓ Google Drive configured');
    return drive;
  } catch (error) {
    console.error('Google Drive initialization error:', error.message);
    return null;
  }
};

// Upload file to Google Drive
const uploadToGoogleDrive = async (file) => {
  try {
    if (!drive) {
      drive = initializeDrive();
    }

    // If Drive is not configured, return local path
    if (!drive) {
      return file.path;
    }

    const fileMetadata = {
      name: `${Date.now()}-${file.originalname}`,
      parents: [DRIVE_FOLDER_ID]
    };

    const media = {
      mimeType: file.mimetype,
      body: fs.createReadStream(file.path)
    };

    const response = await drive.files.create({
      requestBody: fileMetadata,
      media: media,
      fields: 'id, webViewLink, webContentLink'
    });

    // Make file publicly accessible
    await drive.permissions.create({
      fileId: response.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone'
      }
    });

    // Delete local file after successful upload
    fs.unlinkSync(file.path);

    // Return the direct view link
    const viewLink = `https://drive.google.com/uc?export=view&id=${response.data.id}`;
    
    return {
      fileId: response.data.id,
      url: viewLink,
      webViewLink: response.data.webViewLink
    };
  } catch (error) {
    console.error('Google Drive upload error:', error);
    // Return local path as fallback
    return file.path;
  }
};

// Upload multiple files
const uploadMultipleFiles = async (files) => {
  if (!files || files.length === 0) {
    return [];
  }

  const uploadPromises = files.map(file => uploadToGoogleDrive(file));
  const results = await Promise.all(uploadPromises);
  
  return results.map(result => {
    if (typeof result === 'object' && result.url) {
      return result.url;
    }
    return result;
  });
};

// Delete file from Google Drive
const deleteFromGoogleDrive = async (fileIdOrUrl) => {
  try {
    if (!drive) {
      drive = initializeDrive();
    }

    if (!drive) {
      return false;
    }

    // Extract file ID from URL if it's a URL
    let fileId = fileIdOrUrl;
    if (fileIdOrUrl.includes('drive.google.com')) {
      const match = fileIdOrUrl.match(/id=([^&]+)/);
      fileId = match ? match[1] : null;
    }

    if (!fileId) {
      return false;
    }

    await drive.files.delete({
      fileId: fileId
    });

    return true;
  } catch (error) {
    console.error('Google Drive delete error:', error);
    return false;
  }
};

module.exports = {
  uploadToGoogleDrive,
  uploadMultipleFiles,
  deleteFromGoogleDrive,
  DRIVE_FOLDER_ID
};
