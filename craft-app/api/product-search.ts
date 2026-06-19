export default async function handler(req, res) {
 const q = (req.query.q || "").toString().trim()
 const zip = (req.query.zip || "").toString().trim()

 if (!q) return res.status(400).json([])

 try {
   let locationParam = ''
   if (zip) {
     const geoRes = await fetch(`https://api.zippopotam.us/us/${zip}`)
     console.log('zippopotam status:', geoRes.status)
     if (geoRes.ok) {
       const geoData = await geoRes.json()
       console.log('zippopotam data:', JSON.stringify(geoData))
       const place = geoData.places?.[0]
       if (place) {
         locationParam = `${place['place name']}, ${place['state']}`
         console.log('locationParam:', locationParam)
       }
     }
   }

   console.log('final location being sent to serpapi:', locationParam)

   let url = `https://serpapi.com/search.json?engine=google_shopping&q=${encodeURIComponent(q)}&api_key=${process.env.SERPAPI_KEY}`
   if (locationParam) url += `&location=${encodeURIComponent(locationParam)}`

   console.log('serpapi url (no key):', url.replace(process.env.SERPAPI_KEY, 'REDACTED'))

   const r = await fetch(url)
   const data = await r.json()
   console.log('serpapi result count:', data.shopping_results?.length ?? 0)

   const results = (data.shopping_results || [])
     .filter((item) => (item.source || '').toLowerCase() !== 'instacart')
     .map((item) => ({
       name: item.title,
       price: item.extracted_price ?? null,
       store: item.source ?? 'unknown',
       image: item.thumbnail ?? null
     }))

   results.sort((a, b) => Number(a.price || 9999) - Number(b.price || 9999))
   return res.status(200).json(results.slice(0, 5))
 } catch (e) {
   console.error('handler error:', e)
   return res.status(200).json([])
 }
}
