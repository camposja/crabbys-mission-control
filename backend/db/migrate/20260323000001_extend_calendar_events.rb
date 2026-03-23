class ExtendCalendarEvents < ActiveRecord::Migration[8.1]
  def change
    change_table :calendar_events do |t|
      t.string  :status,            null: false, default: "scheduled"
      t.string  :source,            null: false, default: "manual"
      t.bigint  :task_id
      t.bigint  :project_id
      t.string  :agent_id
      t.bigint  :cron_job_id
      t.string  :gateway_reference
      t.datetime :last_run_at
      t.datetime :next_run_at
    end

    add_index :calendar_events, :status
    add_index :calendar_events, :task_id
    add_index :calendar_events, :project_id
    add_index :calendar_events, :agent_id
    add_index :calendar_events, :cron_job_id
    add_index :calendar_events, :next_run_at

    add_foreign_key :calendar_events, :tasks,     on_delete: :nullify
    add_foreign_key :calendar_events, :projects,  on_delete: :nullify
    add_foreign_key :calendar_events, :cron_jobs, on_delete: :nullify
  end
end
