import styles from "../../styles/components/CompoundImage.module.css";
import { getClassNameFactory } from "../../utils/classNames";

const getClassName = getClassNameFactory("CompoundImage", styles);

interface CompoundImageProps {
  src: string;
  alt: string;
  aspectRatio?: "16x9" | "1x1" | "9x16";
  className?: string;
}

export const CompoundImage = ({
  src,
  alt,
  aspectRatio = "16x9",
  className = "",
}: CompoundImageProps) => {
  if (!src) {
    const placeholderAspectClassName = aspectRatio === "16x9" ? "placeholder--16x9" : aspectRatio === "1x1" ? "placeholder--1x1" : "placeholder--9x16";
    return (
      <div className={getClassName(placeholderAspectClassName)}>
        <span>{alt || "Image"}</span>
      </div>
    );
  }

  const aspectClassName = aspectRatio === "16x9" ? "16x9" : aspectRatio === "1x1" ? "1x1" : "9x16";
  return (
    <div className={`${getClassName(aspectClassName)} ${className}`}>
      <img src={src} alt={alt} className={getClassName("img")} />
    </div>
  );
};
