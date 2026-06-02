class AddPolymorphicToLinks < ActiveRecord::Migration[8.1]
  def change
    # Make Link reusable beyond Projects/Tasks via a polymorphic owner.
    # IMPORTANT: existing project_id/task_id columns and rows are left untouched.
    # No backfill — legacy project/task links keep working exactly as before.
    add_reference :links, :linkable, polymorphic: true, null: true, index: true
    add_column :links, :external_id, :string

    # external_id uniqueness scoped PER OWNER (linkable_type + linkable_id).
    add_index :links, [:linkable_type, :linkable_id, :external_id],
              unique: true, where: "external_id IS NOT NULL",
              name: "index_links_on_owner_and_external_id"
  end
end
