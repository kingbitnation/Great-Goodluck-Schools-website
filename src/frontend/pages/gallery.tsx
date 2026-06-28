import { useEffect, useState } from 'react'
import PublicLayout from '../components/layout/PublicLayout'
import { fetchPublic, type PublicGalleryItem } from '../lib/publicApi'

export default function GalleryPage() {
  const [items, setItems] = useState<PublicGalleryItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPublic<PublicGalleryItem[]>('/api/public/gallery')
      .then(setItems)
      .finally(() => setLoading(false))
  }, [])

  return (
    <PublicLayout title="Gallery" subtitle="Life at our school">
      {loading ? (
        <p className="text-slate-500">Loading...</p>
      ) : items.length === 0 ? (
        <p className="text-slate-600">Gallery coming soon.</p>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {items.map((img) => (
            <div
              key={img.id}
              className={`h-48 rounded-lg bg-gradient-to-br ${img.colorClass} flex items-end p-4 text-white font-medium shadow-md overflow-hidden relative`}
            >
              {img.imageUrl && (
                <img src={img.imageUrl} alt={img.title} className="absolute inset-0 h-full w-full object-cover" />
              )}
              <div className="relative z-10">
                <p>{img.title}</p>
                {img.caption && <p className="text-xs opacity-90 mt-1">{img.caption}</p>}
              </div>
            </div>
          ))}
        </div>
      )}
    </PublicLayout>
  )
}
