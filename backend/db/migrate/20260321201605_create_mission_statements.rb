class CreateMissionStatements < ActiveRecord::Migration[8.1]
  def change
    create_table :mission_statements do |t|
      t.text :content
      t.string :updated_by

      t.timestamps
    end
  end
end
