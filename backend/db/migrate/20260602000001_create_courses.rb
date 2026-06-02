class CreateCourses < ActiveRecord::Migration[8.1]
  def change
    create_table :courses do |t|
      t.string  :title, null: false
      t.text    :description
      t.string  :status, null: false, default: "active"
      t.string  :provider
      t.boolean :diploma, null: false, default: false
      t.text    :diploma_notes
      t.date    :started_on
      t.date    :completed_on
      t.string  :external_id
      t.jsonb   :metadata, null: false, default: {}
      t.timestamps
    end

    # external_id is the stable key agents (Hermes/OpenClaw) use to upsert.
    # Global uniqueness for courses; partial so UI-created rows (null) never collide.
    add_index :courses, :external_id, unique: true, where: "external_id IS NOT NULL"
    add_index :courses, :status
  end
end
