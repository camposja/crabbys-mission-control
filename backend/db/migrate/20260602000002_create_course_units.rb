class CreateCourseUnits < ActiveRecord::Migration[8.1]
  def change
    create_table :course_units do |t|
      t.references :course, null: false, foreign_key: true
      t.string  :title, null: false
      t.text    :description
      t.integer :position
      t.string  :unit_type, null: false, default: "topic" # topic | sequential | general
      t.string  :status, null: false, default: "active"
      t.string  :external_id
      t.jsonb   :metadata, null: false, default: {}
      t.timestamps
    end

    # external_id uniqueness is scoped PER COURSE: an agent may reuse keys like
    # "intro"/"module-1" across different courses. Partial so null never collides.
    add_index :course_units, [:course_id, :external_id], unique: true, where: "external_id IS NOT NULL"
    add_index :course_units, [:course_id, :position]
  end
end
