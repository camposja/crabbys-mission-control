class CreateNotes < ActiveRecord::Migration[8.1]
  def change
    create_table :notes do |t|
      # Reusable polymorphic note. Owners today: Course, CourseUnit.
      # (TaskNote is intentionally left untouched — this is the new shared model.)
      t.references :notable, polymorphic: true, null: false, index: true
      t.string :note_type, null: false # course_material | personal
      t.string :title
      t.text   :body, null: false
      t.string :author
      t.string :external_id
      t.jsonb  :metadata, null: false, default: {}
      t.timestamps
    end

    # external_id uniqueness scoped PER OWNER (notable_type + notable_id).
    add_index :notes, [:notable_type, :notable_id, :external_id],
              unique: true, where: "external_id IS NOT NULL",
              name: "index_notes_on_owner_and_external_id"
    add_index :notes, :note_type
  end
end
