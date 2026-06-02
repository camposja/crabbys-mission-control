# This file should ensure the existence of records required to run the application in every environment (production,
# development, test). The code here should be idempotent so that it can be executed at any point in every environment.
# The data can then be loaded with the bin/rails db:seed command (or created alongside the database with db:setup).

# ── Courses ──────────────────────────────────────────────────────────────────
# Idempotent via external_id so re-running db:seed never duplicates.

app_dev = Course.find_or_create_by!(external_id: "app-development-course") do |c|
  c.title       = "App Development Course"
  c.description = "Course material for building and launching apps."
  c.provider    = nil
  c.diploma     = false
end
["Development", "Product", "Marketing"].each_with_index do |title, i|
  app_dev.course_units.find_or_create_by!(external_id: title.parameterize) do |u|
    u.title     = title
    u.unit_type = "topic"
    u.position  = i + 1
  end
end

ecommerce = Course.find_or_create_by!(external_id: "ecommerce-growth-partner") do |c|
  c.title         = "Ecommerce Growth Partner"
  c.description   = "Course material for growing ecommerce clients."
  c.diploma       = true
  c.diploma_notes = "Course includes completion diploma/test material."
end
["Course Material", "Client Acquisition", "Marketing Services", "Diploma/Test Prep"].each_with_index do |title, i|
  ecommerce.course_units.find_or_create_by!(external_id: title.parameterize) do |u|
    u.title     = title
    u.unit_type = "topic"
    u.position  = i + 1
  end
end
