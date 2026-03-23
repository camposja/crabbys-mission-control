import client from "./client";

export const calendarApi = {
  // CalendarController endpoints
  getAll:           ()           => client.get("/calendar").then(r => r.data),
  getEvents:        (params)     => client.get("/calendar/events", { params }).then(r => r.data),
  getCronJobs:      ()           => client.get("/calendar/cron_jobs").then(r => r.data),
  getSummary:       ()           => client.get("/calendar/summary").then(r => r.data),
  getEventHistory:  (id)         => client.get(`/calendar/events/${id}/history`).then(r => r.data),

  // CalendarEvents CRUD
  createEvent:      (data)       => client.post("/calendar_events", { calendar_event: data }).then(r => r.data),
  updateEvent:      (id, data)   => client.patch(`/calendar_events/${id}`, { calendar_event: data }).then(r => r.data),
  destroyEvent:     (id)         => client.delete(`/calendar_events/${id}`).then(r => r.data),
};
