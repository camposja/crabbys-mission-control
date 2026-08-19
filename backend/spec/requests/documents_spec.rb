require "rails_helper"
require "tmpdir"

RSpec.describe "Documents API", type: :request do
  let(:root)      { Dir.mktmpdir("mc-spec") }
  let(:workspace) { File.join(root, "workspace") }
  let(:resumes)   { File.join(workspace, "resumes") }
  let(:outside)   { File.join(root, "outside") }

  before do
    FileUtils.mkdir_p([ resumes, outside ])
    allow(::Openclaw::WorkspaceReader).to receive(:workspace_path).and_return(workspace)
    File.write(File.join(resumes, "cv.txt"), "my resume")
    File.write(File.join(outside, "secret.txt"), "not yours")
  end

  after { FileUtils.remove_entry(root, true) }

  # ── GET /api/v1/documents/download ─────────────────────────────────────────
  describe "GET /api/v1/documents/download" do
    it "serves a downloadable file inside resumes/ by absolute path" do
      get "/api/v1/documents/download", params: { path: File.join(resumes, "cv.txt") }

      expect(response).to have_http_status(:ok)
      expect(response.body).to eq("my resume")
      expect(response.headers["Content-Disposition"]).to include("cv.txt")
    end

    it "serves it by the relative path the listing returns" do
      get "/api/v1/documents/download", params: { path: "cv.txt" }
      expect(response).to have_http_status(:ok)
    end

    it "refuses a traversal path" do
      get "/api/v1/documents/download", params: { path: File.join(resumes, "..", "..", "outside", "secret.txt") }

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.body).not_to include("not yours")
    end

    it "refuses a bare traversal string" do
      get "/api/v1/documents/download", params: { path: "../../etc/passwd" }
      expect(response).to have_http_status(:unprocessable_content)
    end

    # "/…/resumes-evil/x.txt" starts with "/…/resumes" — a prefix check alone lets it through.
    it "refuses a sibling directory whose name starts with the resumes path" do
      sibling = "#{resumes}-evil"
      FileUtils.mkdir_p(sibling)
      File.write(File.join(sibling, "loot.txt"), "sibling loot")

      get "/api/v1/documents/download", params: { path: File.join(sibling, "loot.txt") }

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.body).not_to include("sibling loot")
    end

    it "refuses a symlink inside resumes/ that points outside it" do
      File.symlink(File.join(outside, "secret.txt"), File.join(resumes, "link.txt"))

      get "/api/v1/documents/download", params: { path: File.join(resumes, "link.txt") }

      expect(response).to have_http_status(:unprocessable_content)
      expect(response.body).not_to include("not yours")
    end

    it "refuses a file type that is not downloadable" do
      File.write(File.join(resumes, "notes.md"), "# nope")

      get "/api/v1/documents/download", params: { path: File.join(resumes, "notes.md") }
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "requires a path" do
      get "/api/v1/documents/download", params: { path: "" }
      expect(response).to have_http_status(:unprocessable_content)
    end
  end

  # ── POST /api/v1/documents/upload ──────────────────────────────────────────
  describe "POST /api/v1/documents/upload" do
    def upload(filename, content: "hello", type: "text/plain")
      file = Tempfile.new([ "upload", File.extname(filename) ])
      file.write(content)
      file.rewind
      uploaded = Rack::Test::UploadedFile.new(file.path, type, original_filename: filename)
      post "/api/v1/documents/upload", params: { file: uploaded }
    ensure
      file&.close
    end

    it "stores an allowed file in the workspace" do
      upload("notes.md")

      expect(response).to have_http_status(:created)
      body = JSON.parse(response.body)
      expect(body["name"]).to eq("notes.md")
      expect(File.read(File.join(workspace, "notes.md"))).to eq("hello")
    end

    it "confines a traversing filename to the workspace" do
      upload("../../evil.md", content: "pwned")

      expect(response).to have_http_status(:created)
      expect(JSON.parse(response.body)["name"]).to eq("evil.md")
      expect(File.exist?(File.join(workspace, "evil.md"))).to be(true)
      expect(File.exist?(File.join(root, "evil.md"))).to be(false)
      expect(File.exist?(File.expand_path("../../evil.md", workspace))).to be(false)
    end

    it "strips separators and exotic characters from the stored name" do
      upload("a/b/we ird;name.md")

      expect(response).to have_http_status(:created)
      name = JSON.parse(response.body)["name"]
      expect(name).to eq("we_ird_name.md")
      expect(name).not_to include("/")
      expect(File.exist?(File.join(workspace, name))).to be(true)
    end

    it "refuses a filename that sanitizes to nothing" do
      upload("...md")
      expect(response).to have_http_status(:unprocessable_content)
    end

    it "refuses a file type that is not allowed" do
      upload("payload.exe")

      expect(response).to have_http_status(:unprocessable_content)
      expect(JSON.parse(response.body)["error"]).to include("not allowed")
      expect(Dir.children(workspace)).not_to include("payload.exe")
    end

    it "refuses a file over the size limit" do
      oversize = Api::V1::DocumentsController::MAX_UPLOAD_BYTES + 1
      upload("big.txt", content: "x" * oversize)

      expect(response).to have_http_status(:unprocessable_content)
      expect(JSON.parse(response.body)["error"]).to include("too large")
      expect(File.exist?(File.join(workspace, "big.txt"))).to be(false)
    end

    it "refuses a request with no file" do
      post "/api/v1/documents/upload"
      expect(response).to have_http_status(:unprocessable_content)
    end
  end
end
