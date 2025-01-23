import { Button } from "../ui/button";
import { Link } from "react-router-dom";

export function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Navigation */}
      <nav className="container mx-auto px-6 py-4">
        <div className="flex justify-between items-center">
          <div className="text-2xl font-bold text-blue-600">ServeLocal</div>
          <div className="space-x-4">
            <Button variant="ghost" asChild>
              <Link to="/auth?mode=signin">Sign In</Link>
            </Button>
            <Button asChild>
              <Link to="/auth?mode=signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <div className="container mx-auto px-6 py-24">
        <div className="text-center space-y-8">
          <h1 className="text-5xl font-bold text-gray-900 max-w-3xl mx-auto leading-tight">
            Connecting Communities Through
            <span className="text-blue-600"> Meaningful Service</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Where local organizations and volunteers come together to create positive change.
            Track hours, find opportunities, and make a difference in your community.
          </p>
          <div className="flex justify-center gap-4 pt-4">
            <Button size="lg" asChild>
              <Link to="/auth?mode=signup&type=organization">
                I'm an Organization
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <Link to="/auth?mode=signup&type=volunteer">
                I Want to Volunteer
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="container mx-auto px-6 py-24">
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-12">
          <FeatureCard
            title="For Organizations"
            description="Post volunteer opportunities, track impact, and connect with dedicated volunteers in your community."
            icon="🏢"
          />
          <FeatureCard
            title="For Students"
            description="Find service opportunities, log volunteer hours, and get verified certificates for your contributions."
            icon="👩‍🎓"
          />
          <FeatureCard
            title="For Community"
            description="Build stronger communities through organized volunteering and measurable social impact."
            icon="🤝"
          />
        </div>
      </div>

      {/* Mission Statement */}
      <div className="bg-blue-600 text-white py-24">
        <div className="container mx-auto px-6 text-center">
          <blockquote className="text-3xl font-medium italic max-w-3xl mx-auto">
            "Building stronger communities one act of service at a time."
          </blockquote>
        </div>
      </div>

      {/* Footer */}
      <footer className="container mx-auto px-6 py-12">
        <div className="text-center text-gray-600">
          <p>© 2024 ServeLocal. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// Feature Card Component
function FeatureCard({ title, description, icon }: { title: string; description: string; icon: string }) {
  return (
    <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-100 hover:border-blue-100 transition-colors">
      <div className="text-4xl mb-4">{icon}</div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-gray-600">{description}</p>
    </div>
  );
} 