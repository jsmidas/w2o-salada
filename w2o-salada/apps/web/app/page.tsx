import Header from "./components/Header";
import HeroSection from "./components/HeroSection";
import MarqueeBanner from "./components/MarqueeBanner";
import AboutSection from "./components/AboutSection";
import WeeklyTimeline from "./components/WeeklyTimeline";
import WeeklyMenuSection from "./components/WeeklyMenuSection";
import SubscribeSection from "./components/SubscribeSection";
import DeliverySection from "./components/DeliverySection";
import ReviewsSection from "./components/ReviewsSection";
import CTASection from "./components/CTASection";
import Footer from "./components/Footer";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroSection />
        <MarqueeBanner />
        <AboutSection />
        <WeeklyTimeline />
        <SubscribeSection />
        <WeeklyMenuSection />
        <DeliverySection />
        <ReviewsSection />
        <CTASection />
      </main>
      <Footer />
    </>
  );
}
