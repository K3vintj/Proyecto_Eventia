export type CategoryRect = {
  x: number
  y: number
  width: number
  height: number
}

export type CategoryArrival = {
  slug: string
  title: string
  description: string
  imageUrl: string
  serviceCount: number
  clipPath: string
  rect: CategoryRect
  createdAt: number
}

let arrival: CategoryArrival | null = null

export const beginCategoryTransition = (next: Omit<CategoryArrival, 'createdAt'>) => {
  arrival = { ...next, createdAt: Date.now() }
}

export const readCategoryArrival = (slug: string) => {
  if (!arrival || arrival.slug !== slug || Date.now() - arrival.createdAt > 2500) {
    if (arrival && Date.now() - arrival.createdAt > 2500) arrival = null
    return null
  }
  return arrival
}

export const clearCategoryArrival = (slug: string) => {
  if (arrival?.slug === slug) arrival = null
}

export const hasCategoryArrival = () => Boolean(arrival && Date.now() - arrival.createdAt <= 2500)
