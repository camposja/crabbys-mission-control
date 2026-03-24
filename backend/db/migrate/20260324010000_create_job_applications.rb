class CreateJobApplications < ActiveRecord::Migration[8.1]
  def change
    create_table :job_applications do |t|
      t.string :title, null: false
      t.string :company, null: false
      t.string :location
      t.string :url
      t.string :status, null: false, default: "pending"
      t.string :source, null: false
      t.date :applied_on, null: false
      t.text :notes
      t.jsonb :external_data, null: false, default: {}
      t.string :external_uid, null: false

      t.timestamps
    end

    add_index :job_applications, :applied_on
    add_index :job_applications, :status
    add_index :job_applications, :source
    add_index :job_applications, :external_data, using: :gin
    add_index :job_applications, [:source, :external_uid], unique: true
  end
end
