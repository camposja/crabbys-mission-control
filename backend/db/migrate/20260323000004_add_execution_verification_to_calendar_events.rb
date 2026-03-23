class AddExecutionVerificationToCalendarEvents < ActiveRecord::Migration[8.1]
  def change
    add_column :calendar_events, :run_attempts,       :integer, default: 0, null: false
    add_column :calendar_events, :verified_at,         :datetime
    add_column :calendar_events, :verification_source, :string
    add_column :calendar_events, :execution_detail,    :text
  end
end
