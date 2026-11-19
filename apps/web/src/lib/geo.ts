"use client";

/** 내 위치 → 동(읍·면) 단위 지역. Browser geolocation + OpenStreetMap reverse geocoding (no API key). */
export type Place = { region: string; city: string; area: string; road: string; lat: number; lng: number };

function position(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) {
      reject(new Error("이 브라우저는 위치 기능을 지원하지 않아요."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, (e) => {
      reject(new Error(e.code === 1 ? "위치 권한을 허용해 주세요." : "현재 위치를 찾지 못했어요."));
    }, { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 });
  });
}

type Nominatim = { address?: Record<string, string> };

export async function locate(): Promise<Place> {
  const pos = await position();
  const lat = Math.round(pos.coords.latitude * 10000) / 10000;
  const lng = Math.round(pos.coords.longitude * 10000) / 10000;
  let a: Record<string, string> = {};
  try {
    const r = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=17&accept-language=ko`,
    );
    a = ((await r.json()) as Nominatim).address ?? {};
  } catch {
    /* coordinates alone still work for distance matching */
  }
  const province = a.province || a.state || "";
  const city = a.city || a.county || a.town || "";
  const area = a.quarter || a.suburb || a.neighbourhood || a.village || a.borough || a.city_district || "";
  const region = [province, city, area].filter(Boolean).join(" ") || "내 위치";
  return { region, city, area: area || city || "내 위치", road: a.road || "", lat, lng };
}
