class AddSyncFieldsToCronJobs < ActiveRecord::Migration[8.1]
  def change
    add_column :cron_jobs, :synced_at, :datetime
    add_column :cron_jobs, :sync_source, :string

    add_index :cron_jobs, :sync_source
  end
end
