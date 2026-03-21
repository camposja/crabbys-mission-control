class CreateCronJobs < ActiveRecord::Migration[8.1]
  def change
    create_table :cron_jobs do |t|
      t.string  :name,        null: false
      t.string  :schedule,    null: false
      t.string  :command,     null: false
      t.boolean :enabled,     default: true
      t.datetime :last_run_at
      t.datetime :next_run_at
      t.text    :last_output
      t.string  :status,      default: "idle"

      t.timestamps
    end

    add_index :cron_jobs, :enabled
  end
end
