  useEffect(() => {
    if (!plant.perenual_id) {
      setError('No plant database record for this entry.')
      setLoading(false)
      return
    }
    fetch(`/api/plant-details?id=${plant.perenual_id}`)
      .then(async res => {
        const text = await res.text()
        let data
        try {
          data = JSON.parse(text)
        } catch {
          throw new Error(`Bad response (status ${res.status}): ${text.slice(0, 150)}`)
        }
        if (!res.ok || data.error) {
          throw new Error(`API error (status ${res.status}): ${data.error ?? 'unknown'}`)
        }
        setDetails({
          medicinal: data.medicinal === true,
          poisonous_to_pets: data.poisonous_to_pets === true,
          poisonous_to_humans: data.poisonous_to_humans === true,
          watering: data.watering ?? null,
          sunlight: Array.isArray(data.sunlight) ? data.sunlight : [],
          cycle: data.cycle ?? null,
          care_level: data.care_level ?? null,
          edible_fruit: data.edible_fruit === true,
          edible_leaf: data.edible_leaf === true,
          description: data.description ?? null,
        })
      })
      .catch(err => setError(err.message || 'Could not load plant info.'))
      .finally(() => setLoading(false))
  }, [plant.perenual_id])
