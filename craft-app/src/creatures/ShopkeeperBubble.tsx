import "./ShopkeeperBubble.css";

export type ShopkeeperExpression = "welcome" | "neutral" | "thinking" | "showing";

const EXPRESSION_IMAGES: Record<ShopkeeperExpression, string> = {
  welcome: "/assets/shopkeeperwelcome.png",
  neutral: "/assets/shopkeeperneutral.png",
  thinking: "/assets/shopkeeperthinking.png",
  showing: "/assets/shopkeepershowing.png",
};

interface ShopkeeperBubbleProps {
  expression: ShopkeeperExpression;
  message: string;
}

export default function ShopkeeperBubble({ expression, message }: ShopkeeperBubbleProps) {
  return (
    <div className="shopkeeper-row">
      <img
        src={EXPRESSION_IMAGES[expression]}
        alt="the breeder"
        className="shopkeeper-portrait"
      />
      <div className="shopkeeper-bubble">{message}</div>
    </div>
  );
}
