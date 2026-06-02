import client from "./client";

export const coursesApi = {
  getAll:  ()          => client.get("/courses").then(r => r.data),
  get:     (id)        => client.get(`/courses/${id}`).then(r => r.data),
  create:  (data)      => client.post("/courses", { course: data }).then(r => r.data),
  update:  (id, data)  => client.patch(`/courses/${id}`, { course: data }).then(r => r.data),
  destroy: (id)        => client.delete(`/courses/${id}`).then(r => r.data),

  // Units (nested)
  createUnit:   (courseId, data)         => client.post(`/courses/${courseId}/units`, { course_unit: data }).then(r => r.data),
  updateUnit:   (courseId, unitId, data) => client.patch(`/courses/${courseId}/units/${unitId}`, { course_unit: data }).then(r => r.data),
  destroyUnit:  (courseId, unitId)       => client.delete(`/courses/${courseId}/units/${unitId}`).then(r => r.data),
  reorderUnits: (courseId, orderedIds)   => client.patch(`/courses/${courseId}/units/reorder`, { ordered_ids: orderedIds }).then(r => r.data),

  // Agent-friendly bulk add/update/delete
  bulkUpsert: (data) => client.post("/courses/bulk_upsert", data).then(r => r.data),
};
