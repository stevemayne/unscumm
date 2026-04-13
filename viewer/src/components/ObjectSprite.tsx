import { useEffect, useState } from "react";

interface Props {
  url: string;
}

/**
 * Renders an object sprite, hiding gracefully if the URL doesn't load.
 * Many SCUMM objects have no graphics (pure trigger zones / hotspots), so
 * we expect the load to fail for those and just render nothing.
 *
 * Critically, we reset the `failed` flag whenever the `url` prop changes —
 * otherwise React preserves the state across navigations and the sprite
 * stays hidden for objects that do have valid sprites.
 */
export function ObjectSprite({ url }: Props) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [url]);

  if (failed) return null;
  return (
    <img
      className="object-sprite"
      src={url}
      alt=""
      onError={() => setFailed(true)}
    />
  );
}
