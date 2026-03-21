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

ActiveRecord::Schema[8.1].define(version: 2026_03_21_205845) do
  # These are extensions that must be enabled in order to support this database
  enable_extension "pg_catalog.plpgsql"

  create_table "calendar_events", force: :cascade do |t|
    t.datetime "created_at", null: false
    t.text "description"
    t.datetime "ends_at"
    t.string "event_type"
    t.jsonb "metadata"
    t.string "recurrence"
    t.datetime "starts_at"
    t.string "title"
    t.datetime "updated_at", null: false
  end

  create_table "cron_jobs", force: :cascade do |t|
    t.string "command", null: false
    t.datetime "created_at", null: false
    t.boolean "enabled", default: true
    t.text "last_output"
    t.datetime "last_run_at"
    t.string "name", null: false
    t.datetime "next_run_at"
    t.string "schedule", null: false
    t.string "status", default: "idle"
    t.datetime "updated_at", null: false
    t.index ["enabled"], name: "index_cron_jobs_on_enabled"
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

  create_table "memories", force: :cascade do |t|
    t.string "agent_id"
    t.text "content"
    t.datetime "created_at", null: false
    t.date "date"
    t.string "memory_type"
    t.jsonb "metadata"
    t.string "tags"
    t.datetime "updated_at", null: false
  end

  create_table "mission_statements", force: :cascade do |t|
    t.text "content"
    t.datetime "created_at", null: false
    t.datetime "updated_at", null: false
    t.string "updated_by"
  end

  create_table "projects", force: :cascade do |t|
    t.string "color", default: "#f97316"
    t.datetime "created_at", null: false
    t.text "description"
    t.string "name", null: false
    t.string "status", default: "active"
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

  create_table "tasks", force: :cascade do |t|
    t.string "agent_status"
    t.string "assignee"
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
end
