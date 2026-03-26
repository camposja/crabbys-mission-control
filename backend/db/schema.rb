# This file is auto-generated from the current state of the database. Instead
# of editing this file, please use the migrations feature of Active Record to
# incrementally modify your database, and then regenerate this schema definition.
#
# This file is the source Rails uses to define your schema when running `bin/rails
# db:schema:load`. When creating a new database, `bin/rails db:schema:load` tends to
# be faster and is potentially less error prone than running all of your
# migrations from scratch. Old migrations may fail to apply correctly if those
# migrations use external dependencies or application code.
#
# It's strongly recommended that you check this file into your version control system.

ActiveRecord::Schema[8.1].define(version: 2026_03_25_231700) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "calendar_events", force: :cascade do |t|
    t.string "agent_id"
    t.datetime "created_at", null: false
    t.bigint "cron_job_id"
    t.text "description"
    t.datetime "ends_at"
    t.string "event_type"
    t.text "execution_detail"
    t.string "gateway_reference"
    t.datetime "last_run_at"
    t.jsonb "metadata"
    t.datetime "next_run_at"
    t.bigint "project_id"
    t.string "recurrence"
    t.integer "run_attempts", default: 0, null: false
    t.string "source", default: "manual", null: false
    t.datetime "starts_at"
    t.string "status", default: "scheduled", null: false
    t.bigint "task_id"
    t.string "title"
    t.datetime "updated_at", null: false
    t.string "verification_source"
    t.datetime "verified_at"
    t.index ["agent_id"], name: "index_calendar_events_on_agent_id"
    t.index ["cron_job_id"], name: "index_calendar_events_on_cron_job_id"
    t.index ["next_run_at"], name: "index_calendar_events_on_next_run_at"
    t.index ["project_id"], name: "index_calendar_events_on_project_id"
    t.index ["status"], name: "index_calendar_events_on_status"
    t.index ["task_id"], name: "index_calendar_events_on_task_id"
  end

  create_table "cron_jobs", force: :cascade do |t|
    t.string "agent_id"
    t.string "command", null: false
    t.datetime "created_at", null: false
    t.string "cron_expression", null: false
    t.boolean "enabled", default: true
    t.integer "failure_count", default: 0, null: false
    t.string "gateway_reference"
    t.text "last_error"
    t.text "last_output"
    t.datetime "last_run_at"
    t.string "name", null: false
    t.datetime "next_run_at"
    t.bigint "project_id"
    t.string "status", default: "idle"
    t.string "sync_source"
    t.datetime "synced_at"
    t.bigint "task_id"
    t.datetime "updated_at", null: false
    t.index ["agent_id"], name: "index_cron_jobs_on_agent_id"
    t.index ["enabled"], name: "index_cron_jobs_on_enabled"
    t.index ["project_id"], name: "index_cron_jobs_on_project_id"
    t.index ["sync_source"], name: "index_cron_jobs_on_sync_source"
    t.index ["task_id"], name: "index_cron_jobs_on_task_id"
  end

  create_table "documents", force: :cascade do |t|
    t.string "agent_id"
    t.text "content"
    t.datetime "created_at", null: false
    t.string "doc_type"
    t.jsonb "metadata"
    t.string "path"
    t.integer "project_id"
    t.string "title"
    t.datetime "updated_at", null: false
  end

  create_table "feedbacks", force: :cascade do |t|
    t.text "ai_response"
    t.string "branch_name"
    t.datetime "created_at", null: false
    t.text "description"
    t.string "feedback_type"
    t.jsonb "metadata"
    t.string "status"
    t.string "title"
    t.datetime "updated_at", null: false
  end

  create_table "job_applications", force: :cascade do |t|
    t.date "applied_on", null: false
    t.string "company", null: false
    t.datetime "created_at", null: false
    t.jsonb "external_data", default: {}, null: false
    t.string "external_uid", null: false
    t.string "location"
    t.text "notes"
    t.string "source", null: false
    t.string "status", default: "pending", null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.string "url"
    t.index ["applied_on"], name: "index_job_applications_on_applied_on"
    t.index ["external_data"], name: "index_job_applications_on_external_data", using: :gin
    t.index ["source", "external_uid"], name: "index_job_applications_on_source_and_external_uid", unique: true
    t.index ["source"], name: "index_job_applications_on_source"
    t.index ["status"], name: "index_job_applications_on_status"
  end

  create_table "memories", force: :cascade do |t|
    t.string "agent_id"
    t.text "content"
    t.datetime "created_at", null: false
    t.date "date"
    t.string "memory_type"
    t.jsonb "metadata"
    t.integer "project_id"
    t.string "tags"
    t.datetime "updated_at", null: false
    t.index ["project_id"], name: "index_memories_on_project_id"
  end

  create_table "mission_statements", force: :cascade do |t|
    t.text "content"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "updated_by"
  end

  create_table "ops_notes", force: :cascade do |t|
    t.text "body"
    t.string "category"
    t.text "command_snippet"
    t.datetime "created_at", null: false
    t.datetime "last_used_at"
    t.string "notes_format", default: "markdown", null: false
    t.boolean "pinned", default: false, null: false
    t.string "slug", null: false
    t.jsonb "source_links", default: []
    t.string "status", default: "active", null: false
    t.jsonb "tags", default: []
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.index ["category"], name: "index_ops_notes_on_category"
    t.index ["pinned"], name: "index_ops_notes_on_pinned"
    t.index ["slug"], name: "index_ops_notes_on_slug", unique: true
    t.index ["status"], name: "index_ops_notes_on_status"
  end

  create_table "personal_todos", force: :cascade do |t|
    t.boolean "archived", default: false, null: false
    t.datetime "archived_at"
    t.datetime "completed_at"
    t.datetime "created_at", null: false
    t.boolean "done", default: false, null: false
    t.integer "position", default: 0
    t.string "title", null: false
    t.datetime "updated_at", null: false
  end

  create_table "projects", force: :cascade do |t|
    t.string "color", default: "#f97316"
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name", null: false
    t.string "status", default: "active"
    t.integer "telegram_thread_id"
    t.string "telegram_thread_name"
    t.datetime "updated_at", null: false
    t.index ["status"], name: "index_projects_on_status"
  end

  create_table "settings", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "description"
    t.string "key", null: false
    t.datetime "updated_at", null: false
    t.text "value"
    t.index ["key"], name: "index_settings_on_key", unique: true
  end

  create_table "solid_queue_blocked_executions", force: :cascade do |t|
    t.string "concurrency_key", null: false
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["concurrency_key", "priority", "job_id"], name: "index_solid_queue_blocked_executions_for_release"
    t.index ["expires_at", "concurrency_key"], name: "index_solid_queue_blocked_executions_for_maintenance"
    t.index ["job_id"], name: "index_solid_queue_blocked_executions_on_job_id", unique: true
  end

  create_table "solid_queue_claimed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.bigint "process_id"
    t.index ["job_id"], name: "index_solid_queue_claimed_executions_on_job_id", unique: true
    t.index ["process_id", "job_id"], name: "index_solid_queue_claimed_executions_on_process_id_and_job_id"
  end

  create_table "solid_queue_failed_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "error"
    t.bigint "job_id", null: false
    t.index ["job_id"], name: "index_solid_queue_failed_executions_on_job_id", unique: true
  end

  create_table "solid_queue_jobs", force: :cascade do |t|
    t.string "active_job_id"
    t.text "arguments"
    t.string "class_name", null: false
    t.string "concurrency_key"
    t.datetime "created_at", null: false
    t.datetime "finished_at"
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at"
    t.datetime "updated_at", null: false
    t.index ["active_job_id"], name: "index_solid_queue_jobs_on_active_job_id"
    t.index ["class_name"], name: "index_solid_queue_jobs_on_class_name"
    t.index ["finished_at"], name: "index_solid_queue_jobs_on_finished_at"
    t.index ["queue_name", "finished_at"], name: "index_solid_queue_jobs_for_filtering"
    t.index ["scheduled_at", "finished_at"], name: "index_solid_queue_jobs_for_alerting"
  end

  create_table "solid_queue_pauses", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "queue_name", null: false
    t.index ["queue_name"], name: "index_solid_queue_pauses_on_queue_name", unique: true
  end

  create_table "solid_queue_processes", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.string "hostname"
    t.string "kind", null: false
    t.datetime "last_heartbeat_at", null: false
    t.text "metadata"
    t.string "name", null: false
    t.integer "pid", null: false
    t.bigint "supervisor_id"
    t.index ["last_heartbeat_at"], name: "index_solid_queue_processes_on_last_heartbeat_at"
    t.index ["name", "supervisor_id"], name: "index_solid_queue_processes_on_name_and_supervisor_id", unique: true
    t.index ["supervisor_id"], name: "index_solid_queue_processes_on_supervisor_id"
  end

  create_table "solid_queue_ready_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.index ["job_id"], name: "index_solid_queue_ready_executions_on_job_id", unique: true
    t.index ["priority", "job_id"], name: "index_solid_queue_poll_all"
    t.index ["queue_name", "priority", "job_id"], name: "index_solid_queue_poll_by_queue"
  end

  create_table "solid_queue_recurring_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.datetime "run_at", null: false
    t.string "task_key", null: false
    t.index ["job_id"], name: "index_solid_queue_recurring_executions_on_job_id", unique: true
    t.index ["task_key", "run_at"], name: "index_solid_queue_recurring_executions_on_task_key_and_run_at", unique: true
  end

  create_table "solid_queue_recurring_tasks", force: :cascade do |t|
    t.text "arguments"
    t.string "class_name"
    t.string "command", limit: 2048
    t.datetime "created_at", null: false
    t.text "description"
    t.string "key", null: false
    t.integer "priority", default: 0
    t.string "queue_name"
    t.string "schedule", null: false
    t.boolean "static", default: true, null: false
    t.datetime "updated_at", null: false
    t.index ["key"], name: "index_solid_queue_recurring_tasks_on_key", unique: true
    t.index ["static"], name: "index_solid_queue_recurring_tasks_on_static"
  end

  create_table "solid_queue_scheduled_executions", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.bigint "job_id", null: false
    t.integer "priority", default: 0, null: false
    t.string "queue_name", null: false
    t.datetime "scheduled_at", null: false
    t.index ["job_id"], name: "index_solid_queue_scheduled_executions_on_job_id", unique: true
    t.index ["scheduled_at", "priority", "job_id"], name: "index_solid_queue_dispatch_all"
  end

  create_table "solid_queue_semaphores", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.datetime "expires_at", null: false
    t.string "key", null: false
    t.datetime "updated_at", null: false
    t.integer "value", default: 1, null: false
    t.index ["expires_at"], name: "index_solid_queue_semaphores_on_expires_at"
    t.index ["key", "value"], name: "index_solid_queue_semaphores_on_key_and_value"
    t.index ["key"], name: "index_solid_queue_semaphores_on_key", unique: true
  end

  create_table "task_attachments", force: :cascade do |t|
    t.text "content", null: false
    t.string "content_type", default: "text/plain"
    t.datetime "created_at", null: false
    t.string "filename", null: false
    t.bigint "task_id", null: false
    t.datetime "updated_at", null: false
    t.string "uploaded_by"
    t.index ["task_id"], name: "index_task_attachments_on_task_id"
  end

  create_table "task_notes", force: :cascade do |t|
    t.string "author", null: false
    t.text "body", null: false
    t.datetime "created_at", null: false
    t.bigint "task_id", null: false
    t.datetime "updated_at", null: false
    t.index ["task_id"], name: "index_task_notes_on_task_id"
  end

  create_table "tasks", force: :cascade do |t|
    t.string "agent_status"
    t.datetime "approved_at"
    t.string "approved_by"
    t.string "assignee"
    t.jsonb "assignees", default: [], null: false
    t.datetime "created_at", null: false
    t.text "description"
    t.datetime "due_date"
    t.jsonb "metadata", default: {}
    t.string "openclaw_agent_id"
    t.datetime "plan_approved_at"
    t.text "plan_content"
    t.jsonb "plan_questions"
    t.integer "position", default: 0
    t.string "priority", default: "medium"
    t.integer "project_id"
    t.datetime "state_changed_at"
    t.string "status", default: "backlog", null: false
    t.string "title", null: false
    t.datetime "updated_at", null: false
    t.index ["position"], name: "index_tasks_on_position"
    t.index ["project_id"], name: "index_tasks_on_project_id"
    t.index ["status"], name: "index_tasks_on_status"
  end

  create_table "usage_records", force: :cascade do |t|
    t.string "agent_id"
    t.decimal "cost_usd", precision: 10, scale: 6, default: "0.0"
    t.datetime "created_at", null: false
    t.integer "input_tokens", default: 0
    t.jsonb "metadata", default: {}
    t.string "model_id"
    t.integer "output_tokens", default: 0
    t.datetime "recorded_at", null: false
    t.datetime "updated_at", null: false
    t.index ["agent_id"], name: "index_usage_records_on_agent_id"
    t.index ["model_id"], name: "index_usage_records_on_model_id"
    t.index ["recorded_at"], name: "index_usage_records_on_recorded_at"
  end

  add_foreign_key "calendar_events", "cron_jobs", on_delete: :nullify
  add_foreign_key "calendar_events", "projects", on_delete: :nullify
  add_foreign_key "calendar_events", "tasks", on_delete: :nullify
  add_foreign_key "cron_jobs", "projects", on_delete: :nullify
  add_foreign_key "cron_jobs", "tasks", on_delete: :nullify
  add_foreign_key "memories", "projects", on_delete: :nullify
  add_foreign_key "solid_queue_blocked_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_claimed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_failed_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_ready_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_recurring_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "solid_queue_scheduled_executions", "solid_queue_jobs", column: "job_id", on_delete: :cascade
  add_foreign_key "task_attachments", "tasks"
  add_foreign_key "task_notes", "tasks"
end
