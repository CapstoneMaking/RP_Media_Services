export async function uploadToCloudinary(blob) {
  const url = `https://api.cloudinary.com/v1_1/${process.env.REACT_APP_CLOUDINARY_CLOUD}/upload`;
  
  const formData = new FormData();
  formData.append("file", blob);
  formData.append("upload_preset", process.env.REACT_APP_CLOUDINARY_UPLOAD_PRESET);

  const response = await fetch(url, {
    method: "POST",
    body: formData,
  });

  const data = await response.json();
  
  if (!response.ok) {
    throw new Error(data.error?.message || "Upload failed");
  }
  
  return data.secure_url;
}