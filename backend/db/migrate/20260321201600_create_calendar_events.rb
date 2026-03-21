class CreateCalendarEvents < ActiveRecord::Migration[8.1]
  def change
    create_table :calendar_events do |t|
      t.string :title
      t.text :description
      t.datetime :starts_at
      t.datetime :ends_at
      t.string :event_type
      t.string :recurrence
      t.jsonb :metadata

      t.timestamps
    end
  end
end
