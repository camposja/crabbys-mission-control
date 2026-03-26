import client from "./client";

export const taskNotesApi = {
  getAll:  (taskId) => client.get(`/tasks/${taskId}/task_notes`).then(r => r.data),
  create:  (taskId, data) => client.post(`/tasks/${taskId}/task_notes`, { task_note: data }).then(r => r.data),
};

export const taskAttachmentsApi = {
  getAll:  (taskId) => client.get(`/tasks/${taskId}/task_attachments`).then(r => r.data),
  create:  (taskId, data) => client.post(`/tasks/${taskId}/task_attachments`, { task_attachment: data }).then(r => r.data),
  destroy: (taskId, id) => client.delete(`/tasks/${taskId}/task_attachments/${id}`).then(r => r.data),
};

export const taskApproveApi = {
  approve: (taskId, data = {}) => client.post(`/tasks/${taskId}/approve`, data).then(r => r.data),
};
