import multer from "multer";
import path from "path";

// Storage config
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

// File filter (images only)
const fileFilter = (req, file, cb) => {
  const ext = path.extname(file.originalname);
  if (ext !== ".png" && ext !== ".jpg" && ext !== ".jpeg") {
    return cb(new Error("Only images allowed"));
  }
  cb(null, true);
};

export const upload = multer({ storage, fileFilter });
