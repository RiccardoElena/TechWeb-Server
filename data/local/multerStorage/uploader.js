import multer from 'multer';

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '-' + file.originalname);
  },
});

const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/jpg'];

export const uploader = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024,
  },
  fileFilter: (req, file, cb) => {
    if (!allowedTypes.includes(file.mimetype)) {
      return cb({ status: 400, message: 'Unsupported file type' }, false);
    }

    const ext = file.originalname.toLowerCase();
    if (
      !ext.endsWith('.jpg') &&
      !ext.endsWith('.jpeg') &&
      !ext.endsWith('.png') &&
      !ext.endsWith('.gif')
    ) {
      return cb({ status: 400, message: 'Unsupported file extension' }, false);
    }

    cb(null, true);
  },
});
