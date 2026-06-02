class AllowNullProjectOnLinks < ActiveRecord::Migration[8.1]
  # Polymorphic (course/unit) links have no project. Relax the NOT NULL
  # constraint so project_id can be null for linkable-owned links.
  # Existing project/task rows are untouched — they keep their project_id, and
  # the app still always sets project_id on the legacy path. No backfill.
  def change
    change_column_null :links, :project_id, true
  end
end
