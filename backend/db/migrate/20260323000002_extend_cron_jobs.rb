class ExtendCronJobs < ActiveRecord::Migration[8.1]
  def change
    # Rename schedule -> cron_expression
    rename_column :cron_jobs, :schedule, :cron_expression

    change_table :cron_jobs do |t|
      t.bigint  :task_id
      t.bigint  :project_id
      t.string  :agent_id
      t.integer :failure_count, null: false, default: 0
      t.text    :last_error
      t.string  :gateway_reference
    end

    add_index :cron_jobs, :task_id
    add_index :cron_jobs, :project_id
    add_index :cron_jobs, :agent_id

    add_foreign_key :cron_jobs, :tasks,    on_delete: :nullify
    add_foreign_key :cron_jobs, :projects, on_delete: :nullify
  end
end
