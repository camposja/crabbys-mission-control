import client from "./client";

export const documentsApi = {
  getAll:        (params = {}) => client.get("/documents", { params }).then(r => r.data),
  getContent:    (path) => client.get("/documents/content", { params: { path } }).then(r => r.data),
  updateContent: (path, content) =>
    client.patch("/documents/content", { path, content }).then(r => r.data),
  search:        (q) => client.get("/documents/search", { params: { q } }).then(r => r.data),
  upload:        (file) => {
    const form = new FormData();
    form.append("file", file);
    return client.post("/documents/upload", form, {
      headers: { "Content-Type": "multipart/form-data" },
    }).then(r => r.data);
  },

  // Resumes
  getResumes:    (subpath) => client.get("/documents/resumes", { params: { path: subpath } }).then(r => r.data),
  downloadUrl:   (path) => `${client.defaults.baseURL}/documents/download?path=${encodeURIComponent(path)}`,
};
